import {useEffect, useState} from 'react';
import Question from './components/Question';
import Column from './components/Column';

function App() {
  const [total, setTotal] = useState(0);
  return (
    <div class="flex flex-col justify-center items-center">
    <div class="flex flex-row justify-center items-center">
      <Column setTotal={setTotal} total={total}/>
      <Column setTotal={setTotal} total={total}/>
      <Column setTotal={setTotal} total={total}/>
      <Column setTotal={setTotal} total={total}/>
      <Column setTotal={setTotal} total={total}/>
      <Column setTotal={setTotal} total={total}/>
      
    </div>

    <p>Total: {total}</p>
    </div>
  );
}

export default App;
