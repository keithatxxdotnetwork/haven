import { WithChildren } from 'src/types';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useUtils } from 'src/contexts/utils-context';
import { v4 as uuid } from 'uuid';
import useAccountSync, { AccountSyncService, AccountSyncStatus } from 'src/hooks/useAccountSync';
import useLocalStorage from 'src/hooks/useLocalStorage';
import { AppEvents, appBus as bus } from 'src/events';
import { CMIX_INITIALIZATION_KEY } from 'src/constants';

type AuthenticationContextType = {
  setSyncLoginService: (service: AccountSyncService) => void;
  cancelSyncLogin: () => void;
  cmixPreviouslyInitialized: boolean;
  attemptingSyncedLogin: boolean;
  getOrInitPassword: (password: string) => Promise<boolean>;
  encryptedPassword?: Uint8Array;
  rawPassword?: string;
  isAuthenticated: boolean;
  setIsAuthenticated: (authenticated: boolean) => void;
  instanceId: string;
};

export const AuthenticationContext = React.createContext<AuthenticationContextType>({
  isAuthenticated: false
} as AuthenticationContextType);

AuthenticationContext.displayName = 'AuthenticationContext';

export const AuthenticationProvider: FC<WithChildren> = (props) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const instanceId = useMemo(() => uuid(), []);
  const { utils } = useUtils();
  const authChannel = useMemo<BroadcastChannel>(() => new BroadcastChannel('authentication'), []);
  const [rawPassword, setRawPassword] = useState<string>();

  const {
    setService: setAccountSyncService,
    setStatus: setAccountSyncStatus,
    status: accountSyncStatus
  } = useAccountSync();
  const [cmixPreviouslyInitialized, setCmixWasPreviouslyInitialized] = useLocalStorage(
    CMIX_INITIALIZATION_KEY,
    false
  );

  const setSyncLoginService = useCallback(
    (service: AccountSyncService) => {
      setAccountSyncService(service);
      setAccountSyncStatus(AccountSyncStatus.Synced);
    },
    [setAccountSyncService, setAccountSyncStatus]
  );

  const cancelSyncLogin = useCallback(() => {
    setAccountSyncStatus(AccountSyncStatus.NotSynced);
    setAccountSyncService(AccountSyncService.None);
  }, [setAccountSyncService, setAccountSyncStatus]);

  useEffect(() => {
    const listener = () => {
      setRawPassword('');
    };
    bus.addListener(AppEvents.NEW_SYNC_CMIX_FAILED, listener);

    return () => {
      bus.removeListener(AppEvents.NEW_SYNC_CMIX_FAILED, listener);
    };
  }, []);

  const getOrInitPassword = useCallback(
    async (password: string) => {
      try {
        setRawPassword(password);
        bus.emit(AppEvents.PASSWORD_ENTERED, password);
        const encrypted = await utils.GetOrInitPassword(password);
        bus.emit(AppEvents.PASSWORD_DECRYPTED, encrypted, password);
        return true;
      } catch (error) {
        console.error('GetOrInitPassword failed', error);
        return false;
      }
    },
    [utils]
  );

  useEffect(() => {
    const onRequest = (ev: MessageEvent) => {
      if (ev.data.type === 'IS_AUTHENTICATED_REQUEST') {
        authChannel.postMessage({
          type: 'IS_AUTHENTICATED_RESPONSE',
          isAuthenticated,
          instanceId
        });
      }
    };

    authChannel.addEventListener('message', onRequest);

    return () => {
      authChannel.removeEventListener('message', onRequest);
    };
  }, [authChannel, isAuthenticated, instanceId]);

  useEffect(() => {
    const listener = () => {
      setCmixWasPreviouslyInitialized(true);
    };

    bus.addListener(AppEvents.CHANNEL_MANAGER_LOADED, listener);

    return () => {
      bus.removeListener(AppEvents.CHANNEL_MANAGER_LOADED, listener);
    };
  }, [setCmixWasPreviouslyInitialized]);

  return (
    <AuthenticationContext.Provider
      value={{
        setSyncLoginService,
        cancelSyncLogin,
        cmixPreviouslyInitialized: !!cmixPreviouslyInitialized,
        attemptingSyncedLogin:
          !cmixPreviouslyInitialized && accountSyncStatus === AccountSyncStatus.Synced,
        getOrInitPassword,
        instanceId,
        rawPassword,
        isAuthenticated,
        setIsAuthenticated
      }}
      {...props}
    />
  );
};

export const useAuthentication = () => {
  const context = React.useContext(AuthenticationContext);

  if (context === undefined) {
    throw new Error('useAuthentication must be used within a AuthenticationProvider');
  }

  return context;
};
