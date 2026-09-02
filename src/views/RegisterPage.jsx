'use client'
import Link from 'next/link'

// Écran « choisir son profil » — split plein écran, effet Tilt 3D :
// le contenu de chaque moitié s'incline vers le curseur + halo lumineux qui suit
// la souris, la moitié survolée se déploie. Rendu sans Navbar (voir ClientLayout).
export default function RegisterPage() {
  const prefersReduced = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const handleMove = (e) => {
    const panel = e.currentTarget
    const content = panel.querySelector('.rp-content')
    const r = panel.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    panel.style.setProperty('--mx', `${(x / r.width) * 100}%`)
    panel.style.setProperty('--my', `${(y / r.height) * 100}%`)
    if (content && !prefersReduced()) {
      content.style.setProperty('--rx', `${((0.5 - y / r.height) * 10).toFixed(2)}deg`)
      content.style.setProperty('--ry', `${((x / r.width - 0.5) * 12).toFixed(2)}deg`)
    }
  }
  const handleLeave = (e) => {
    const content = e.currentTarget.querySelector('.rp-content')
    if (content) { content.style.setProperty('--rx', '0deg'); content.style.setProperty('--ry', '0deg') }
  }

  return (
    <div className="rp-root">
      <style>{`
        .rp-root{height:100dvh;overflow:hidden;display:flex;flex-direction:column;background:#0f0b08;color:#fff}
        .rp-top{display:flex;align-items:center;justify-content:space-between;gap:12px;
          padding:14px 20px;flex-shrink:0;z-index:20;position:relative}
        .rp-brand{display:flex;align-items:center;gap:9px;font-family:var(--font-poppins),Poppins,sans-serif;font-weight:700;font-size:15px;color:#fff}
        .rp-brand .m{width:30px;height:30px;border-radius:9px;background:#E87722;color:#fff;display:grid;place-items:center;font-weight:800}
        .rp-brand em{font-style:normal;color:#F5A24A}
        .rp-login{display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:13.5px;color:#fff;
          text-decoration:none;border:1px solid rgba(255,255,255,.28);border-radius:12px;padding:9px 16px;
          background:rgba(255,255,255,.08);transition:.2s;backdrop-filter:blur(6px)}
        .rp-login b{color:#F5A24A} .rp-login:hover{border-color:#F5A24A;background:rgba(255,255,255,.16)}

        .rp-split{flex:1;display:flex;min-height:0;position:relative}
        .rp-panel{position:relative;flex:1;overflow:hidden;color:#fff;text-decoration:none;isolation:isolate;
          display:flex;align-items:center;perspective:1100px;
          transition:flex-grow .6s cubic-bezier(.65,0,.2,1),filter .5s}
        .rp-panel.p{background:radial-gradient(130% 130% at 30% 15%,#2D6A4F,#153525)}
        .rp-panel.t{background:radial-gradient(130% 130% at 70% 15%,#E87722,#9E480D)}
        .rp-split:hover .rp-panel{flex-grow:.72;filter:saturate(.7) brightness(.78)}
        .rp-split .rp-panel:hover{flex-grow:2;filter:none}

        /* halo lumineux qui suit la souris */
        .rp-panel::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;
          background:radial-gradient(circle 300px at var(--mx,50%) var(--my,50%),rgba(255,255,255,.18),transparent 60%);
          opacity:0;transition:opacity .3s}
        .rp-panel:hover::after{opacity:1}

        .rp-content{position:relative;z-index:3;width:100%;display:flex;flex-direction:column;justify-content:center;gap:15px;
          padding:6vh clamp(26px,5.5vw,72px);transform-style:preserve-3d;
          transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .18s ease-out}
        .rp-content.r{align-items:flex-end;text-align:right}
        .rp-head{display:flex;align-items:center;gap:12px}
        .rp-content.r .rp-head{flex-direction:row-reverse}
        .rp-ico{font-size:clamp(36px,4.6vw,54px);line-height:1;transition:transform .5s cubic-bezier(.34,1.56,.64,1)}
        .rp-panel:hover .rp-ico{transform:scale(1.14) rotate(-6deg)}
        .rp-tag{font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.22)}
        .rp-h{font-family:var(--font-poppins),Poppins,sans-serif;font-weight:800;font-size:clamp(26px,4vw,44px);margin:0;letter-spacing:-.02em}
        .rp-pitch{font-size:15px;max-width:32ch;opacity:.95;margin:0}
        .rp-perks{display:flex;flex-direction:column;gap:9px}
        .rp-content.r .rp-perks{align-items:flex-end}
        .rp-perk{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:500;
          opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s}
        .rp-content.r .rp-perk{flex-direction:row-reverse}
        .rp-perk i{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.25);display:grid;place-items:center;font-size:11px;font-style:normal;flex-shrink:0}
        .rp-cta{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;background:#fff;color:#153525;
          font-family:var(--font-poppins),Poppins,sans-serif;font-weight:700;font-size:14px;padding:12px 22px;border-radius:14px;
          box-shadow:0 14px 26px -14px rgba(0,0,0,.6);opacity:0;transform:translateY(8px);transition:opacity .45s,transform .45s}
        .rp-content.r .rp-cta{align-self:flex-end;color:#9E480D}
        .rp-panel:hover .rp-perk{opacity:1;transform:none}
        .rp-panel:hover .rp-perk:nth-child(2){transition-delay:.06s}
        .rp-panel:hover .rp-perk:nth-child(3){transition-delay:.12s}
        .rp-panel:hover .rp-cta{opacity:1;transform:none;transition-delay:.14s}

        .rp-hint{text-align:center;padding:12px;flex-shrink:0;font-size:13px;color:rgba(255,255,255,.7);
          background:#0f0b08;z-index:20}
        .rp-hint a{color:#F5A24A;font-weight:600;text-decoration:none}
        .rp-hint a:hover{text-decoration:underline}

        @media (max-width:760px){
          .rp-split{flex-direction:column}
          .rp-panel{transition:none}
          .rp-split:hover .rp-panel,.rp-split .rp-panel:hover{flex-grow:1;filter:none}
          .rp-content{padding:3.5vh 8vw;gap:10px;transform:none!important}
          .rp-content.r{align-items:flex-start;text-align:left}
          .rp-content.r .rp-head{flex-direction:row}
          .rp-content.r .rp-perks{align-items:flex-start}
          .rp-content.r .rp-perk{flex-direction:row}
          .rp-content.r .rp-cta{align-self:flex-start}
          .rp-pitch{display:none}
          .rp-perk,.rp-cta{opacity:1;transform:none}
          .rp-ico{font-size:32px}
          .rp-h{font-size:26px}
        }
        @media (prefers-reduced-motion:reduce){
          .rp-content{transform:none!important} .rp-perk,.rp-cta{opacity:1!important;transform:none!important}
          .rp-panel,.rp-ico{transition:none!important}
        }
      `}</style>

      <header className="rp-top">
        <Link href="/" className="rp-brand"><span className="m">M</span>Mon<em>Répétiteur</em></Link>
        <Link href="/connexion" className="rp-login"><span>Déjà un compte&nbsp;?</span> <b>Se connecter</b></Link>
      </header>

      <div className="rp-split">
        <Link href="/inscription/parent" className="rp-panel p" onPointerMove={handleMove} onPointerLeave={handleLeave}>
          <div className="rp-content">
            <div className="rp-head"><span className="rp-ico">👨‍👩‍👧</span><span className="rp-tag">Gratuit</span></div>
            <h2 className="rp-h">Je suis parent</h2>
            <p className="rp-pitch">Je cherche un répétiteur qualifié et vérifié pour mon enfant.</p>
            <div className="rp-perks">
              <div className="rp-perk"><i>✓</i> Recherche illimitée</div>
              <div className="rp-perk"><i>✓</i> Je recrute en 1 clic</div>
              <div className="rp-perk"><i>✓</i> Messagerie sécurisée après contrat</div>
            </div>
            <span className="rp-cta">Commencer →</span>
          </div>
        </Link>

        <Link href="/inscription/repetiteur" className="rp-panel t" onPointerMove={handleMove} onPointerLeave={handleLeave}>
          <div className="rp-content r">
            <div className="rp-head"><span className="rp-ico">🎓</span><span className="rp-tag">dès 3 000 FCFA/mois</span></div>
            <h2 className="rp-h">Je suis répétiteur</h2>
            <p className="rp-pitch">Je propose mes cours et je développe mon activité.</p>
            <div className="rp-perks">
              <div className="rp-perk"><i>✓</i> Profil visible dans les recherches</div>
              <div className="rp-perk"><i>✓</i> Demandes de recrutement des parents</div>
              <div className="rp-perk"><i>✓</i> Paiement au moment d'accepter</div>
            </div>
            <span className="rp-cta">Créer mon profil →</span>
          </div>
        </Link>
      </div>

      <div className="rp-hint">Déjà inscrit&nbsp;? <Link href="/connexion">Se connecter</Link></div>
    </div>
  )
}
