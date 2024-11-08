import type { WithChildren } from 'src/types';
import React, { FC, useEffect, useState } from 'react';

import { NextSeo } from 'next-seo';
import { AppProps } from 'next/app';
import Head from 'next/head';
// import { useRouter } from 'next/router';
import { Provider } from 'react-redux';
import { useTranslation } from 'react-i18next';

import store from 'src/store';
import { ManagedUIContext } from 'src/contexts/ui-context';
import { ManagedNetworkContext } from 'src/contexts/network-client-context';
import { AuthenticationProvider } from 'src/contexts/authentication-context';
import { UtilsProvider } from 'src/contexts/utils-context';
import { isDuplicatedWindow } from 'src/utils/oneTabEnforcer';

import 'src/assets/scss/main.scss';
import 'src/assets/scss/quill-overrides.scss';
import 'react-tooltip/dist/react-tooltip.css';
import ErrorBoundary from 'src/components/common/ErrorBoundary';
import { DBProvider } from '@contexts/db-context';
import '../i18n';
import 'src/utils/extend-dayjs';
import { RemoteKVProvider } from '@contexts/remote-kv-context';
import { DMContextProvider } from '@contexts/dm-client-context';

// const regexp = /android|iphone|iPhone|kindle|ipad|iPad|Harmony|harmony|Tizen|tizen/i;
// const isDesktop = () => {
//   const details = navigator.userAgent;
//   return !regexp.test(details);
// };

const Noop: FC<WithChildren> = ({ children }) => <>{children}</>;

export const WarningComponent: FC<WithChildren> = ({ children }) => {
  const { t } = useTranslation();
  return (
    <>
      <Head>
        <title>{t('Internet Haven')}</title>
        <link rel='icon' href='/favicon.svg' />
      </Head>
      <div className='h-screen w-full flex justify-center items-center px-20'>
        <h1
          className='headline m-auto text-center'
          style={{
            fontSize: '48px',
            color: 'var(--cyan)',
            lineHeight: '1.2'
          }}
        >
          {children}
        </h1>
      </div>
    </>
  );
};

const SEO = () => {
  const [url, setUrl] = useState('');
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setUrl(`${window.location.origin}${window.location.pathname}`);
    setOrigin(window.location.origin);
  }, []);
  return (
    <NextSeo
      openGraph={{
        type: 'website',
        url: url,
        title: 'Haven',
        description:
          'The internet Haven. True Freedom to express yourself, your thoughts, your beliefs. Speak easily to a group of friends or a global community. Talk about what you want. Surveillance free. Censorship proof. Your Haven chats are yours.',
        images: [
          {
            url: `${origin}/haven-icon.png`,
            width: 200,
            height: 43,
            alt: 'Haven'
          }
        ]
      }}
    />
  );
};

const Providers: FC<WithChildren> = ({ children }) => (
  <RemoteKVProvider>
    <DBProvider>
      <Provider store={store}>
        <UtilsProvider>
          <AuthenticationProvider>
            <DMContextProvider>
              <ManagedNetworkContext>
                <ManagedUIContext>{children}</ManagedUIContext>
              </ManagedNetworkContext>
            </DMContextProvider>
          </AuthenticationProvider>
        </UtilsProvider>
      </Provider>
    </DBProvider>
  </RemoteKVProvider>
);

const HavenApp = ({ Component, pageProps }: AppProps) => {
  const { t } = useTranslation();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    setShouldRender(true);
  }, []);
  // const router = useRouter();

  // useEffect(() => {
  //   if (!isDesktop()) {
  //     router.push('https://haven.xx.network/mobile/');
  //   }
  // }, [router]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Layout = (Component as any).Layout || Noop;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipDuplicateTabCheck = (Component as any).skipDuplicateTabCheck;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AllProviders = (Component as any).skipProviders ? React.Fragment : Providers;

  if (shouldRender) {
    return (
      <ErrorBoundary>
        <Head>
          <title>{t('internet haven')}</title>
          <link rel='icon' href='/favicon.svg' />
        </Head>
        <SEO />
        <AllProviders>
          {!skipDuplicateTabCheck && isDuplicatedWindow(15000, 10000, 'HavenApp') ? (
            <WarningComponent>
              {t('Haven can only run with one tab/window at a time.')}
              <br />
              {t('Return to your Haven home tab to continue.')}
            </WarningComponent>
          ) : (
            <Layout pageProps={{ ...pageProps }}>
              <Component {...pageProps} />
            </Layout>
          )}
        </AllProviders>
      </ErrorBoundary>
    );
  } else {
    return (
      <ErrorBoundary>
        <Head>
          <title>{t('internet haven')}</title>
          <link rel='icon' href='/favicon.svg' />
        </Head>
        <SEO />
      </ErrorBoundary>
    );
  }
};

export default HavenApp;
