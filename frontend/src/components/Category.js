import React from 'react'

function Category(props) {
  return (
    <div class="flex flex-col justify-center items-center bg-blue-700" style={{minWidth: "15em", minHeight: "4em", border: "1px solid black"}}>
      <p style={{color: "white"}}>{props.category}</p>
    </div>
  )
}

export default Category
