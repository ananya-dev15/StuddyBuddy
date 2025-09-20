import React, {useState} from 'react'
import API from '../services/api'

export default function Register(){
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  async function submit(e){ e.preventDefault(); await API.post('/auth/register',{name,email,password}); alert('registered - please login'); }
  return (
    <form onSubmit={submit} className="w-full max-w-md bg-white shadow p-6 rounded">
      <h2 className="text-2xl mb-4">Register</h2>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="name" className="w-full p-2 border mb-3" />
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" className="w-full p-2 border mb-3" />
      <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" type="password" className="w-full p-2 border mb-3" />
      <button className="bg-green-600 text-white px-4 py-2 rounded">Register</button>
    </form>
  )
}
