import { HeadsetBubble } from './icons'

export default function SupportBanner({ resolved = false }) {
  return (
    <section className="banner">
      <div className="banner-copy">
        <h2>Account support</h2>
        <p>We&apos;re here to help with your account 24/7</p>
        <div className="banner-status">
          <span className="dot light" />
          {resolved ? 'Issue resolved' : 'Online'}
        </div>
      </div>
      <HeadsetBubble />
    </section>
  )
}
