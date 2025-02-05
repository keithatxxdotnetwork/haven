import { type ChannelJSON, PrivacyLevel } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import cn from 'classnames';
import { useTranslation } from 'react-i18next';

import { useNetworkClient } from 'src/contexts/network-client-context';
import { useUtils } from 'src/contexts/utils-context';
import WarningComponent from 'src/components/common/WarningComponent';
import JoinChannelView from 'src/components/views/JoinChannel';
import { Button } from 'src/components/common';
import { Spinner } from 'src/components/common';
import { decoder } from 'src/utils';
import { channelDecoder } from 'src/utils/decoders';
import { useAuthentication } from 'src/contexts/authentication-context';

import CheckboxToggle from 'src/components/common/CheckboxToggle';

const Join = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<
    boolean | 'loading' | 'no-response'
  >('loading');
  const { getShareUrlType } = useNetworkClient();
  const { instanceId } = useAuthentication();
  const [withLink, setWithLink] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [channelType, setChannelType] = useState<null | PrivacyLevel>(null);
  const { utils, utilsLoaded } = useUtils();
  const [channelInfoJson, setChannelInfoJson] = useState<ChannelJSON>();
  const [channelPrettyPrint, setChannelPrettyPrint] = useState('');
  const broadcastChannel = useMemo<BroadcastChannel>(
    () => new BroadcastChannel('join_channel'),
    []
  );
  const authChannel = useMemo<BroadcastChannel>(() => new BroadcastChannel('authentication'), []);

  const [isLoading, setIsLoading] = useState(true);
  const [dmsEnabled, setDmsEnabled] = useState<boolean>(true);

  useEffect(() => {
    authChannel.postMessage({ type: 'IS_AUTHENTICATED_REQUEST' });
    const onResponse = (ev: MessageEvent) => {
      if (ev.data.type === 'IS_AUTHENTICATED_RESPONSE' && instanceId !== ev.data.instanceId) {
        setIsUserAuthenticated(ev.data.isAuthenticated);
      }
    };

    setInterval(() => {
      setIsUserAuthenticated((auth) => (auth === 'loading' ? 'no-response' : auth));
    }, 2000);

    authChannel.addEventListener('message', onResponse);

    return () => {
      authChannel.removeEventListener('message', onResponse);
    };
  }, [authChannel, instanceId]);

  useEffect(() => {
    if (location.search.length) {
      setWithLink(true);
    }
  }, [location.search]);

  useEffect(() => {
    if (channelType === 0 || channelType === 2) {
      if (isUserAuthenticated === 'no-response') {
        const params = new URLSearchParams(location.search);
        navigate({ pathname: '/', search: params.toString() });
      }
    }
  }, [channelType, isUserAuthenticated, navigate, location.search]);

  useEffect(() => {
    if (utilsLoaded && isUserAuthenticated !== 'loading' && isUserAuthenticated !== 'no-response') {
      setIsLoading(false);
    }
  }, [isLoading, isUserAuthenticated, utilsLoaded]);

  useEffect(() => {
    if (withLink) {
      const urlType = getShareUrlType(window.location.href);
      setChannelType(urlType);
    }
  }, [isUserAuthenticated, withLink, getShareUrlType]);

  useEffect(() => {
    if (channelType === PrivacyLevel.Public && broadcastChannel) {
      const prettyPrinted = utils.DecodePublicURL(window.location.href);
      const infoJson = channelDecoder(
        JSON.parse(decoder.decode(utils.GetChannelJSON(prettyPrinted)))
      );
      setChannelPrettyPrint(prettyPrinted);
      setChannelInfoJson(infoJson);
    }
  }, [broadcastChannel, channelType, utils]);

  const joinPrivateChannel = () => {
    if (password) {
      try {
        const prettyPrinted = utils.DecodePrivateURL(window.location.href, password);
        const infoJson = channelDecoder(
          JSON.parse(decoder.decode(utils.GetChannelJSON(prettyPrinted)))
        );
        setChannelPrettyPrint(prettyPrinted);
        setChannelInfoJson(infoJson);
      } catch (e) {
        setError('Invalid passphrase');
      }
    }
  };

  const attemptJoinChannel = () => {
    if (channelPrettyPrint && broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'JOIN_CHANNEL',
        prettyPrint: channelPrettyPrint,
        dmsEnabled
      });
    }
  };

  if (isLoading) {
    return (
      <div className={'w-full h-screen flex justify-center items-center'}>
        <Spinner size='lg' />
      </div>
    );
  }

  if (withLink && typeof channelType !== 'number') {
    return (
      <WarningComponent>
        {t('This invite link is invalid.')}
        <br />
        {t('Return to your Haven home tab to continue.')}
      </WarningComponent>
    );
  }

  if (!withLink) {
    return (
      <WarningComponent>
        {t('Haven can only run with one tab/window at a time.')}
        <br />
        {t('Return to your Haven home tab to continue.')}
      </WarningComponent>
    );
  }

  if (isUserAuthenticated === false) {
    return (
      <WarningComponent>
        {t('Cannot join a chat when the user is not logged in.')}
        <br />
        {t('Return to the signup page to create an identity or log in.')}
      </WarningComponent>
    );
  }

  return (
    <>
      {channelInfoJson && window?.location?.href && (
        <JoinChannelView
          dmsEnabled={dmsEnabled}
          onDmsEnabledChange={setDmsEnabled}
          channelInfo={channelInfoJson}
          url={window.location.href}
          onConfirm={attemptJoinChannel}
        />
      )}
      {!channelInfoJson && window?.location?.href && channelType === 2 && (
        <div className="flex flex-col items-center">
          <h2 className="mt-9 mb-6">{t('This Haven Chat requires a passphrase to join')}</h2>
          <div className="w-full max-w-[534px]">
            <input
              className="mt-3 mb-4"
              name=""
              type="password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  joinPrivateChannel();
                }
              }}
              placeholder={t('Enter passphrase')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
            />

            <div className="flex justify-between mt-8 px-3">
              <h3 className="headline--sm">{t('Enable Direct Messages')}</h3>
              <CheckboxToggle checked={dmsEnabled} onChange={() => setDmsEnabled((e) => !e)} />
            </div>
            {error && (
              <div className="text text--xs mt-2 text-center text-[var(--red)]">
                {error}
              </div>
            )}
            <div className="flex justify-center">
              <Button 
                className="mb-7 mt-8 text-black disabled:cursor-not-allowed"
                onClick={joinPrivateChannel}
              >
                {t('Confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Skip duplicate tab check for join route
Join.skipDuplicateTabCheck = true;

export default Join;
