import React from 'react'
import {useEffect, useState} from 'react';
import DisplayScreen from './DisplayScreen';
function Question(props) {
  
  const [showQuestion, setShowQuestion] = useState(false);
  const [removeQuestion, setRemoveQuestion] = useState(false);
  const [checkAnswer, setCheckAnswer] = useState(false);
  const handleButtonClick = () => {
    setShowQuestion(true);
    setRemoveQuestion(true);
    setTimeout(() => {
      setShowQuestion(false)
    }, 15000);
    
  }

  return (
    <div class="flex flex-row justify-center items-center bg-blue-700" style={{minWidth: "15em", minHeight: "10em", border: "1px solid black"}}>
      {removeQuestion ? null : <button onClick={handleButtonClick} style={{color: "white"}}><strong>{props.amount}</strong></button>}
  
        {showQuestion ? <DisplayScreen question={props.question}  questionChanger={setShowQuestion} answer={props.answer} setTotal={props.setTotal} total={props.total} change={props.amount}/> : null}
    
    </div>
  )

}

export default Question
