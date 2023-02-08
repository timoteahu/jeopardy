import React from 'react'
import Category from './Category';
import Question from './Question';
function Column(props) {
  return (

    <div class="flex flex-col justify-center items-center mt-10">
        <Category category="category" />
        <Question question="hello!" amount={200} answer="hi" setTotal={props.setTotal} total={props.total}/>
        <Question question="hello!" amount={400} answer="hi" setTotal={props.setTotal} total={props.total}/>
        <Question question="hello!" amount={600} answer="hi" setTotal={props.setTotal} total={props.total}/>
        <Question question="hello!" amount={800} answer="hi" setTotal={props.setTotal} total={props.total}/>
        <Question question="hello!" amount={1000} answer="hi" setTotal={props.setTotal} total={props.total}/>
    </div>
  )
}

export default Column
