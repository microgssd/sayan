import type { Metadata } from 'next';
import { loadPortfolio } from '@/lib/ledger';
import { getLang, getDict } from '@/lib/i18n/server';
import { fmt } from '@/lib/i18n';
import { localizeSettings } from '@/lib/defaults';
import { replyEmailsEnabled } from '@/lib/chat-core';
import { resolveTechIcons } from '@/lib/tech-icons';
import { SmoothScroll } from '@/components/smooth-scroll';
import { Intro } from '@/components/site/intro';
import { CursorFollower } from '@/components/site/motion-kit';
import { SiteNav } from '@/components/site/nav';
import { Hero } from '@/components/site/hero';
import { About } from '@/components/site/about';
import { Work } from '@/components/site/work';
import { Stack } from '@/components/site/stack';
import { Gallery } from '@/components/site/gallery';
import { Contact } from '@/components/site/contact';
import { ChatWidget } from '@/components/site/chat-widget';
import { TitleSync } from '@/components/site/title-sync';


export async function generateMetadata(): Promise<Metadata> {
  const lang = getLang();
  const settings = localizeSettings((await loadPortfolio()).settings, lang);
  const title = fmt(getDict(lang).meta.title, { name: settings.name });
  return {
    title: { absolute: title },
    description: settings.headline,
    openGraph: { title, description: settings.headline, type: 'website', locale: lang },
    twitter: { card: 'summary_large_image', title, description: settings.headline },
  };
}

export default async function HomePage() {
  // Raw settings and projects include every translation; components pick the visitor's language in the browser.
  const { settings, projects, stats } = await loadPortfolio();
  const stack = [...new Set(settings.stacks.flatMap((g) => g.items))];
  const tech = resolveTechIcons(stack);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: settings.name,
    jobTitle: getDict().meta.role,
    email: `mailto:${settings.email}`,
    image: settings.photoUrl || undefined,
    sameAs: Object.values(settings.socials).filter(Boolean),
    knowsAbout: stack,
  };

  return (
    <SmoothScroll>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Intro name={settings.name}>
        <CursorFollower />
        <TitleSync name={settings.name} />
        <SiteNav name={settings.name} />
        <main>
          <Hero settings={settings} stats={stats} tech={tech} projects={projects} />
          <About settings={settings} />
          <Work projects={projects} />
          <Gallery projects={projects} extra={settings.galleryImages} />
          <Stack settings={settings} />
        </main>
        <Contact settings={settings} />
        <ChatWidget ownerName={settings.name} photoUrl={settings.photoUrl} emailReplies={replyEmailsEnabled()} />
      </Intro>
    </SmoothScroll>
  );
}
