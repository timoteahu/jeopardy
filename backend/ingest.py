"""Bulk-import Jeopardy clues into the database from a TSV dump.

Designed for the jwolle1/jeopardy_clue_dataset release files
(https://github.com/jwolle1/jeopardy_clue_dataset/releases), ~550k clues
covering seasons 1-42. Columns:

    round  clue_value  daily_double_value  category  comments
    answer question    air_date            notes

Dataset quirk: `answer` is the prompt shown on the board (our clue_text) and
`question` is the correct response (our answer). `round` is 1/2/3 for
Jeopardy/Double Jeopardy/Final Jeopardy.

Usage:
    pip install -r requirements.txt
    python ingest.py path/to/combined_season1-42.tsv
    python ingest.py seasons/season*.tsv        # per-season files set games.season

Env: DATABASE_URL (defaults to local Supabase, see db.py).
Idempotent: games are keyed by air_date; each game's clues are deleted and
reinserted on every run, so re-running refreshes instead of duplicating.
"""

import argparse
import csv
import os
import re
from collections import defaultdict

from sqlalchemy import delete, select

from db import SessionLocal
from models import Category, Clue, Game

ROUND_MAP = {"1": "J", "2": "DJ", "3": "FJ"}


def season_from_filename(path: str) -> int | None:
    m = re.search(r"season(\d+)", os.path.basename(path))
    return int(m.group(1)) if m else None


def get_or_create_game(session, game_cache, air_date: str, season: int | None):
    if air_date in game_cache:
        return game_cache[air_date]
    game = session.scalar(select(Game).where(Game.air_date == air_date))
    if game is None:
        game = Game(air_date=air_date, season=season)
        session.add(game)
        session.flush()
    elif season is not None and game.season is None:
        game.season = season
    game_cache[air_date] = game
    return game


def get_or_create_category(session, category_cache, name: str):
    if name in category_cache:
        return category_cache[name]
    category = session.scalar(select(Category).where(Category.name == name))
    if category is None:
        category = Category(name=name, canonical_name=name.lower().strip())
        session.add(category)
        session.flush()
    category_cache[name] = category
    return category


def ingest(paths: list[str], limit: int | None = None):
    session = SessionLocal()
    session.expire_on_commit = False
    game_cache: dict[str, Game] = {}
    category_cache: dict[str, Category] = {}
    # dataset is chronological, so a game's rows are contiguous: buffer the
    # current game only, insert + commit each time air_date changes
    order_counters: dict[tuple[str, str, int], int] = defaultdict(int)
    pending_rows: list[dict] = []
    current_air_date: str | None = None
    current_game_id: int | None = None
    cleared_games: set[int] = set()
    games = 0
    total = skipped = 0

    def flush_game():
        if current_game_id is not None and pending_rows:
            session.execute(Clue.__table__.insert(), pending_rows)
            session.commit()
            pending_rows.clear()

    try:
        done = False
        for path in paths:
            season = season_from_filename(path)
            with open(path, newline="", encoding="utf-8") as f:
                for row in csv.DictReader(f, delimiter="\t"):
                    air_date = (row.get("air_date") or "").strip()
                    round_num = ROUND_MAP.get((row.get("round") or "").strip())
                    clue_text = (row.get("answer") or "").strip()
                    answer = (row.get("question") or "").strip()
                    if not air_date or not round_num or not clue_text or not answer:
                        skipped += 1
                        continue

                    if air_date != current_air_date:
                        flush_game()
                        order_counters.clear()
                        game = get_or_create_game(
                            session, game_cache, air_date, season
                        )
                        current_air_date, current_game_id = air_date, game.id
                        games += 1
                        if game.id not in cleared_games:
                            session.execute(
                                delete(Clue).where(Clue.game_id == game.id)
                            )
                            cleared_games.add(game.id)
                        if games % 500 == 0:
                            print(f"  {games} games / {total} clues...", flush=True)

                    raw_value = (row.get("clue_value") or "").strip()
                    value = int(raw_value) if raw_value.isdigit() else None
                    dd_raw = (row.get("daily_double_value") or "").strip()
                    daily_double = dd_raw.isdigit() and int(dd_raw) > 0

                    category = get_or_create_category(
                        session,
                        category_cache,
                        (row.get("category") or "").strip(),
                    )
                    key = (air_date, round_num, category.id)
                    order_counters[key] += 1
                    pending_rows.append(
                        {
                            "game_id": current_game_id,
                            "category_id": category.id,
                            "round": round_num,
                            "value": value,
                            "clue_text": clue_text,
                            "answer": answer,
                            "daily_double": daily_double,
                            "clue_order": order_counters[key],
                        }
                    )
                    total += 1
                    if limit and total >= limit:
                        done = True
                        break
            if done:
                break

        flush_game()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    print(
        f"ingested {total} clues, skipped {skipped}, "
        f"games={len(cleared_games)}, categories={len(category_cache)}"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+", help="TSV file(s) to import")
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    ingest(args.paths, args.limit)


if __name__ == "__main__":
    main()
