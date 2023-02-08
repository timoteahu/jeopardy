import React from 'react'
import {useEffect, useState} from 'react';


function DisplayScreen({questionChanger, question, answer, setTotal, total, change}) {

    let submit = function(e) {
        questionChanger(false);
        if(document.getElementById("thing").value != answer) {
            setTotal(total - change);
        }
        else {
            setTotal(total + change);
        }
        e.preventDefault();
    }

    return (
        <div class="flex flex-col justify-center items-center">
            <p style={{color: "white"}} class="mb-4">{question}</p>
            <form onSubmit={submit}>
            <input type="text" id="thing" placeholder="Answer" style={{width: "5em"}}></input>
            </form>
        </div>
    )
}

export default DisplayScreen