import React, { useEffect } from 'react'

export default function LandingPage() {
  // To handle the global body styles from the HTML exactly as provided
  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.width = '100%'
    document.body.style.height = '100%'
    document.body.style.background = '#350304'
    document.body.style.overflow = 'hidden'
    document.body.style.fontFamily = 'Arial, sans-serif'
    
    return () => {
      document.body.style = ''
    }
  }, [])

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .page { position: relative; width: 100%; height: 100svh; display: flex; align-items: flex-end; justify-content: center; }
        .hero { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; }
        .overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 55%, rgba(53,3,4,.18) 68%, rgba(53,3,4,.82) 100%); }
        .content { position: relative; z-index: 2; text-align: center; margin-bottom: 42px; width: min(90%, 500px); }
        .title { color: #fff; font-family: Georgia, "Times New Roman", serif; font-size: clamp(25px, 6vw, 42px); font-weight: 400; margin: 0 0 10px; }
        .subtitle { color: rgba(255,255,255,.82); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; margin-bottom: 22px; }
        .button { display: inline-flex; align-items: center; justify-content: center; min-width: 190px; height: 48px; padding: 0 28px; border: 1px solid #ceae6e; border-radius: 2px; background: #ceae6e; color: #350304; text-decoration: none; font-size: 10px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; transition: .25s ease; }
        .button:hover { background: transparent; color: #ceae6e; }
        @media (max-width: 600px) {
          .hero { object-position: center; }
          .content { margin-bottom: 28px; }
          .title { font-size: 27px; }
          .subtitle { font-size: 9px; letter-spacing: .14em; }
        }
      `}</style>
      
      <main className="page">
        <img className="hero" src="/gh-shopper-cover.jpg" alt="GH Shopper" />
        <div className="overlay"></div>
        <div className="content">
          <h1 className="title">Something Exceptional Is Coming.</h1>
          <div className="subtitle">A new GH Shopper experience</div>
          <a className="button" href="#">Explore GH Shopper</a>
        </div>
      </main>
    </>
  )
}
