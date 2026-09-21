"""Build the clue knowledge graph.

Embeds every clue with sentence-transformers (all-MiniLM-L6-v2), clusters the
embeddings into topics, and writes the result into the existing graph tables:

  - nodes      type='topic' rows, one per cluster, named after the most common
               answer in the cluster
  - edges      'related-to' links between a topic and its nearest topics, and
               'contains' links from existing 'category' nodes to topics
  - clue_nodes clue -> topic link (relevance = cosine sim to centroid), plus
               clue -> existing entity/category nodes for strong matches

Usage:
    SUPABASE_URL=... SUPABASE_KEY=... python build_graph.py [--apply]

Without --apply it runs the embedding + clustering stages and prints the
proposed node names only (dry run).
"""

import argparse
import html
import json
import os
import re
from collections import Counter, defaultdict

import numpy as np
import requests

PAGE = 1000
EMBED_MODEL = "all-MiniLM-L6-v2"
N_CLUSTERS = 250
TOPIC_NEIGHBORS = 3  # related-to edges per topic
EXISTING_NODE_MAX_CLUES = 300  # cap clue links per existing node
EXISTING_NODE_MIN_SIM = 0.35
CATEGORY_NODE_TOPICS = 5  # topics each 'category' node contains
INSERT_CHUNK = 1000

TAG_RE = re.compile(r"<[^>]+>")
PAREN_RE = re.compile(r"\([^)]*\)")
WS_RE = re.compile(r"\s+")


def clean(text: str) -> str:
    text = html.unescape(TAG_RE.sub(" ", text or ""))
    return WS_RE.sub(" ", text).strip()


def clean_answer(ans: str) -> str:
    ans = clean(ans)
    ans = PAREN_RE.sub("", ans).strip().strip('"').strip()
    return ans


def get_all(base, headers, path, params):
    out = []
    start = 0
    while True:
        h = dict(headers)
        h["Range-Unit"] = "items"
        h["Range"] = f"{start}-{start + PAGE - 1}"
        r = requests.get(f"{base}{path}", params=params, headers=h, timeout=120)
        r.raise_for_status()
        rows = r.json()
        out += rows
        if len(rows) < PAGE:
            break
        start += PAGE
    return out


def post(base, headers, path, rows, upsert=False):
    h = dict(headers)
    h["Content-Type"] = "application/json"
    h["Prefer"] = "resolution=merge-duplicates,return=representation" if upsert else "return=representation"
    r = requests.post(f"{base}{path}", json=rows, headers=h, timeout=300)
    if not r.ok:
        raise RuntimeError(f"POST {path} failed: {r.status_code} {r.text[:500]}")
    return r.json()


def delete_all(base, headers, path, params):
    r = requests.delete(f"{base}{path}", params=params, headers=headers, timeout=300)
    r.raise_for_status()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write results to Supabase")
    ap.add_argument("--clues-file", default="/home/ubuntu/clues.json")
    ap.add_argument("--categories-file", default="/home/ubuntu/categories.json")
    args = ap.parse_args()

    base = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
    key = os.environ["SUPABASE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    clues = json.load(open(args.clues_file))
    cats = {c["id"]: c for c in json.load(open(args.categories_file))}
    print(f"loaded {len(clues)} clues, {len(cats)} categories")

    # --- embed ---
    from sentence_transformers import SentenceTransformer

    texts = []
    for c in clues:
        cat = cats.get(c["category_id"], {})
        cat_name = cat.get("canonical_name") or cat.get("name") or ""
        texts.append(f"{cat_name}: {clean(c['clue_text'])} Answer: {clean_answer(c['answer'])}")

    model = SentenceTransformer(EMBED_MODEL)
    if os.path.exists("/home/ubuntu/clue_embeddings.npy"):
        emb = np.load("/home/ubuntu/clue_embeddings.npy")
        print("loaded cached embeddings:", emb.shape)
    else:
        print("embedding...")
        emb = model.encode(
            texts, batch_size=256, show_progress_bar=True,
            normalize_embeddings=True, convert_to_numpy=True,
        ).astype(np.float32)
        np.save("/home/ubuntu/clue_embeddings.npy", emb)
        print("embedded:", emb.shape)

    # --- cluster ---
    from sklearn.cluster import MiniBatchKMeans

    print("clustering...")
    km = MiniBatchKMeans(n_clusters=N_CLUSTERS, batch_size=8192, random_state=0, n_init=3)
    if os.path.exists("/home/ubuntu/clue_labels.npy"):
        labels = np.load("/home/ubuntu/clue_labels.npy")
        km.cluster_centers_ = np.stack(
            [emb[labels == k].mean(axis=0) for k in range(N_CLUSTERS)]
        )
    else:
        labels = km.fit_predict(emb)
        np.save("/home/ubuntu/clue_labels.npy", labels)
    centroids = km.cluster_centers_
    centroids /= np.linalg.norm(centroids, axis=1, keepdims=True)

    # name clusters by most common answer among high-similarity members
    members = defaultdict(list)
    for i, lab in enumerate(labels):
        members[lab].append(i)

    node_names = {}
    used_names = set()
    for lab, idxs in members.items():
        sims = emb[idxs] @ centroids[lab]
        keep = [idxs[j] for j in np.argsort(-sims)[: max(20, len(idxs) // 4)]]
        answers = Counter(clean_answer(clues[j]["answer"]) for j in keep)
        name, n = answers.most_common(1)[0]
        name = name or f"topic-{lab}"
        base_name, suffix = name, 2
        while name in used_names:
            name = f"{base_name} ({suffix})"
            suffix += 1
        used_names.add(name)
        node_names[lab] = (name, len(idxs), n)

    print("\n=== proposed topics ===")
    for lab in sorted(node_names, key=lambda l: -node_names[l][1]):
        name, size, n = node_names[lab]
        print(f"  {name!r:40s} clues={size:5d} answer_count={n}")

    if not args.apply:
        print("\ndry run — pass --apply to write to Supabase")
        return

    # --- write ---
    existing_nodes = get_all(base, headers, "/nodes", {"select": "id,name,type,description"})
    print(f"existing nodes: {len(existing_nodes)}")

    # clear previous auto-generated rows: only 'topic' nodes whose description
    # carries our auto-clustered marker, so hand-seeded topics are preserved
    topic_nodes = [
        n for n in existing_nodes
        if n["type"] == "topic" and "auto-clustered" in (n["description"] or "")
    ]
    if topic_nodes:
        ids = ",".join(str(n["id"]) for n in topic_nodes)
        delete_all(base, headers, "/clue_nodes", {"node_id": f"in.({ids})"})
        delete_all(base, headers, "/edges", {"or": f"(source_node_id.in.({ids}),target_node_id.in.({ids}))"})
        delete_all(base, headers, "/nodes", {"id": f"in.({ids})"})
        print(f"cleared {len(topic_nodes)} old topic nodes")

    new_nodes = [
        {
            "name": node_names[lab][0],
            "type": "topic",
            "description": f"{node_names[lab][1]} related clues (auto-clustered)",
        }
        for lab in range(N_CLUSTERS)
    ]
    inserted = post(base, headers, "/nodes", new_nodes)
    name_to_lab = {node_names[lab][0]: lab for lab in range(N_CLUSTERS)}
    lab_to_node = {name_to_lab[row["name"]]: row["id"] for row in inserted}
    print(f"inserted {len(inserted)} topic nodes")

    # edges between topics: nearest centroids
    cent_sim = centroids @ centroids.T
    np.fill_diagonal(cent_sim, -1)
    edge_rows = []
    seen = set()
    for lab in range(N_CLUSTERS):
        for other in np.argsort(-cent_sim[lab])[:TOPIC_NEIGHBORS]:
            pair = tuple(sorted((lab_to_node[lab], lab_to_node[other])))
            if pair in seen:
                continue
            seen.add(pair)
            edge_rows.append(
                {
                    "source_node_id": pair[0],
                    "target_node_id": pair[1],
                    "edge_type": "related-to",
                    "weight": float(cent_sim[lab][other]),
                }
            )

    # 'contains' edges: existing category nodes -> nearest topics
    cat_nodes = [n for n in existing_nodes if n["type"] == "category"]
    if cat_nodes:
        cat_texts = [f"{n['name']}: {n['description'] or ''}" for n in cat_nodes]
        cat_emb = model.encode(cat_texts, normalize_embeddings=True, convert_to_numpy=True)
        for n, ce in zip(cat_nodes, cat_emb):
            sims = centroids @ ce
            for lab in np.argsort(-sims)[:CATEGORY_NODE_TOPICS]:
                edge_rows.append(
                    {
                        "source_node_id": n["id"],
                        "target_node_id": lab_to_node[lab],
                        "edge_type": "contains",
                        "weight": float(sims[lab]),
                    }
                )

    for i in range(0, len(edge_rows), INSERT_CHUNK):
        post(base, headers, "/edges", edge_rows[i : i + INSERT_CHUNK], upsert=True)
    print(f"inserted {len(edge_rows)} edges")

    # clue_nodes: every clue -> its topic
    clue_node_rows = [
        {"clue_id": clues[i]["id"], "node_id": lab_to_node[int(labels[i])],
         "relevance": float(emb[i] @ centroids[labels[i]])}
        for i in range(len(clues))
    ]

    # clue_nodes: strong matches to existing hand-curated nodes
    # (any type, but not auto-clustered topics that were just wiped)
    keep_nodes = [
        n for n in existing_nodes
        if not (n["type"] == "topic" and "auto-clustered" in (n["description"] or ""))
    ]
    if keep_nodes:
        node_texts = [f"{n['name']}: {n['description'] or ''}" for n in keep_nodes]
        node_emb = model.encode(node_texts, normalize_embeddings=True, convert_to_numpy=True)
        sims = emb @ node_emb.T  # (n_clues, n_nodes)
        for j, n in enumerate(keep_nodes):
            col = sims[:, j]
            top = np.argsort(-col)[:EXISTING_NODE_MAX_CLUES]
            added = 0
            for i in top:
                if col[i] >= EXISTING_NODE_MIN_SIM:
                    clue_node_rows.append(
                        {"clue_id": clues[i]["id"], "node_id": n["id"], "relevance": float(col[i])}
                    )
                    added += 1
            print(f"  linked {added} clues -> {n['name']!r}")

    for i in range(0, len(clue_node_rows), INSERT_CHUNK):
        post(base, headers, "/clue_nodes", clue_node_rows[i : i + INSERT_CHUNK], upsert=True)
        if i % (INSERT_CHUNK * 20) == 0:
            print(f"  clue_nodes progress: {i}/{len(clue_node_rows)}")
    print(f"inserted {len(clue_node_rows)} clue_nodes links")
    print("done")


if __name__ == "__main__":
    main()
