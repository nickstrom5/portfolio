import { Header } from "@/components/site/Header";
import { Hero } from "@/components/site/Hero";
import { WhatWeBuild } from "@/components/site/WhatWeBuild";
import { DemoShowcase } from "@/components/site/DemoShowcase";
import { PromptLab } from "@/components/site/PromptLab";
import { Outcomes } from "@/components/site/Outcomes";
import { Foundation } from "@/components/site/Foundation";
import { Engagement } from "@/components/site/Engagement";
import { AboutSite } from "@/components/site/AboutSite";
import { Footer } from "@/components/site/Footer";

export default function Page() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <WhatWeBuild />
        <DemoShowcase />
        <PromptLab />
        <Outcomes />
        <Foundation />
        <Engagement />
        <AboutSite />
      </main>
      <Footer />
    </>
  );
}
