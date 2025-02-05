import type { CMix, DummyTraffic, RawCipher, WithChildren } from 'src/types';
import type { ChannelManager } from './network-client-context';
import type { DMClient } from 'src/types';

import React, { FC, useCallback, useState } from 'react';
import { decoder } from 'src/utils/index';
import Loading from 'src/components/views/LoadingView';
import { identityDecoder } from 'src/utils/decoders';
import { RemoteStore } from 'src/types/collective';
import { ChannelEventHandler, DMEventHandler } from 'src/events';
import { WebAssemblyRunner } from 'src/components/common';
import { useTranslation } from 'react-i18next';
import { PrivacyLevel } from 'src/types';
import { CMIX_INITIALIZATION_KEY } from 'src/constants';

export type ChannelManagerCallbacks = {
  EventUpdate: ChannelEventHandler;
};

export type DMClientEventCallback = {
  EventUpdate: DMEventHandler;
};

export type Notifications = {
  AddToken: (newToken: string, app: string) => void;
  RemoveToken: () => void;
  SetMaxState: (maxState: number) => void;
  GetMaxState: () => number;
  GetID: () => number;
};

export type XXDKUtils = {
  NewCmix: (
    ndf: string,
    storageDir: string,
    password: Uint8Array,
    registrationCode: string
  ) => Promise<void>;
  NewSynchronizedCmix: (
    ndf: string,
    storageDir: string,
    remoteStoragePrefixPath: string,
    password: Uint8Array,
    remoteStore: RemoteStore
  ) => Promise<void>;
  LoadCmix: (
    storageDirectory: string,
    password: Uint8Array,
    cmixParams: Uint8Array
  ) => Promise<CMix>;
  LoadSynchronizedCmix: (
    storageDirectory: string,
    password: Uint8Array,
    remoteStore: RemoteStore,
    cmixParams: Uint8Array
  ) => Promise<CMix>;
  LoadNotifications: (cmixId: number) => Notifications;
  LoadNotificationsDummy: (cmixId: number) => Notifications;
  GetDefaultCMixParams: () => Uint8Array;
  GetChannelInfo: (prettyPrint: string) => Uint8Array;
  Base64ToUint8Array: (base64: string) => Uint8Array;
  GenerateChannelIdentity: (cmixId: number) => Uint8Array;
  NewChannelsManagerWithIndexedDb: (
    cmixId: number,
    wasmJsPath: string,
    privateIdentity: Uint8Array,
    extensionBuilderIDsJSON: Uint8Array,
    notificationsId: number,
    callbacks: ChannelManagerCallbacks,
    channelDbCipher: number
  ) => Promise<ChannelManager>;
  NewDMClientWithIndexedDb: (
    cmixId: number,
    notificationsId: number,
    cipherId: number,
    wasmJsPath: string,
    privateIdentity: Uint8Array,
    eventCallback: DMClientEventCallback
  ) => Promise<DMClient>;
  NewDatabaseCipher: (
    cmixId: number,
    storagePassword: Uint8Array,
    payloadMaximumSize: number
  ) => RawCipher;
  LoadChannelsManagerWithIndexedDb: (
    cmixId: number,
    wasmJsPath: string,
    storageTag: string,
    extensionBuilderIDsJSON: Uint8Array,
    notificationsId: number,
    callbacks: ChannelManagerCallbacks,
    channelDbCipher: number
  ) => Promise<ChannelManager>;
  GetPublicChannelIdentityFromPrivate: (privateKey: Uint8Array) => Uint8Array;
  IsNicknameValid: (nickname: string) => null;
  GetShareUrlType: (url: string) => PrivacyLevel;
  GetVersion: () => string;
  GetClientVersion: () => string;
  GetOrInitPassword: (password: string) => Promise<Uint8Array>;
  ImportPrivateIdentity: (password: string, privateIdentity: Uint8Array) => Uint8Array;
  ConstructIdentity: (publicKey: Uint8Array, codesetVersion: number) => Uint8Array;
  DecodePrivateURL: (url: string, password: string) => string;
  DecodePublicURL: (url: string) => string;
  GetChannelJSON: (prettyPrint: string) => Uint8Array;
  NewDummyTrafficManager: (
    cmixId: number,
    maximumOfMessagesPerCycle: number,
    durationToWaitBetweenSendsMilliseconds: number,
    upperBoundIntervalBetweenCyclesMilliseconds: number
  ) => DummyTraffic;
  GetWasmSemanticVersion: () => Uint8Array;
  Purge: (userPassword: string) => void;
  ValidForever: () => number;
};

const initialUtils = {
  shouldRenderImportCodeNameScreen: false
} as unknown as XXDKUtils;

export type XXDKContext = {
  utils: XXDKUtils;
  setUtils: (utils: XXDKUtils) => void;
  utilsLoaded: boolean;
  setUtilsLoaded: (loaded: boolean) => void;
  getCodeNameAndColor: (publicKey: string, codeset: number) => { codename: string; color: string };
};

export const UtilsContext = React.createContext<XXDKContext>({
  utils: initialUtils,
  utilsLoaded: false,
  shouldRenderImportCodeNameScreen: false
} as unknown as XXDKContext);

UtilsContext.displayName = 'UtilsContext';

export type IdentityJSON = {
  PubKey: string;
  Codename: string;
  Color: string;
  Extension: string;
  CodesetVersion: number;
};

// Clear the storage in case a half assed registration was made
if (typeof window !== 'undefined' && localStorage.getItem(CMIX_INITIALIZATION_KEY) === 'false') {
  localStorage.clear();
}

export const UtilsProvider: FC<WithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const [utils, setUtils] = useState<XXDKUtils>();
  const [utilsLoaded, setUtilsLoaded] = useState<boolean>(false);

  const getCodeNameAndColor = useCallback(
    (publicKey: string, codeset: number) => {
      if (!utils || !utils.ConstructIdentity || !utils.Base64ToUint8Array) {
        return { codename: '', color: 'var(--text-primary)' };
      }

      let pubkeyUintArray: Uint8Array;
      try {
        pubkeyUintArray = utils.Base64ToUint8Array(publicKey);
      } catch (e) {
        const msg = `Invalid public key: ${publicKey}: ${e}`;
        throw new Error(msg);
      }

      try {
        const identityJson = identityDecoder(
          JSON.parse(decoder.decode(utils.ConstructIdentity(pubkeyUintArray, codeset)))
        );

        return {
          codename: identityJson.codename,
          color: identityJson.color.replace('0x', '#')
        };
      } catch (e) {
        const msg = `Failed to construct identity from: ${JSON.stringify({ publicKey, codeset })}`;
        throw new Error(msg);
      }
    },
    [utils]
  );

  return (
    <UtilsContext.Provider
      value={{
        utils: utils as XXDKUtils,
        setUtils,
        utilsLoaded,
        setUtilsLoaded,
        getCodeNameAndColor
      }}
    >
      <WebAssemblyRunner>
        {utils ? children : <Loading message={t('Loading XXDK...')} />}
      </WebAssemblyRunner>
    </UtilsContext.Provider>
  );
};

export const useUtils = () => {
  const context = React.useContext(UtilsContext);

  if (context === undefined) {
    throw new Error('useUtils must be used within a UtilsProvider');
  }

  return context;
};
