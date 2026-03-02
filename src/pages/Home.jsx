import HeroSection from '../components/sections/HeroSection'
import ProductShowcase from '../components/sections/ProductShowcase'
import FeatureCards from '../components/sections/FeatureCards'
import FaqSection from '../components/sections/FaqSection'
import CtaSection from '../components/sections/CtaSection'

export default function Home() {
  return (
    <>
      <HeroSection />
      <ProductShowcase />
      <FeatureCards />
      <FaqSection />
      <CtaSection />
    </>
  )
}
