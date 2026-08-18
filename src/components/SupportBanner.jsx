import { HeadsetBubble } from './icons'

export default function SupportBanner() {
  return (
    <section className="banner">
      <div className="banner-copy">
        <h2>Account support</h2>
        <p>We&apos;re here to help with your account 24/7</p>
        <div className="banner-status">
          <span className="dot light" />
          Online
        </div>
      </div>
      <HeadsetBubble />
    </section>
  )
}
