import React,{useState} from "react";
import './workflow.css';
import Step1Upload from "./Step1Upload";
import Step2SelectPoints from "./Step2SelectPoints";
import Step3PreviewExport from "./Step3PreviewExport";

export default function ENHWorkflow(){
  const [step,setStep]=useState(1);
  const [points,setPoints]=useState([]);

  const nextStep=()=>setStep(s=>Math.min(s+1,3));
  const prevStep=()=>setStep(s=>Math.max(s-1,1));

  return (
    <div>
      {step===1 && <Step1Upload onDataLoaded={(data)=>{setPoints(data); nextStep();}} />}
      {step===2 && <Step2SelectPoints points={points} onApply={(newPoints)=>{setPoints(newPoints); nextStep();}} />}
      {step===3 && <Step3PreviewExport points={points} />}

      <div style={{marginTop:12,display:'flex',justifyContent:'space-between'}}>
        {step>1 && <button onClick={prevStep}>Back</button>}
        {step<3 && <button onClick={nextStep}>Next</button>}
      </div>
    </div>
  );
}