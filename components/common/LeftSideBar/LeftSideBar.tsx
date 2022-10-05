import { FC, useState, useEffect } from "react";
import s from "./LeftSideBar.module.scss";
import cn from "classnames";
import { Button, Collapse, NetworkStatusIcon } from "@components/common";
import { Elixxir, SpeakEasy } from "@components/icons";
import { useUI } from "contexts/ui-context";
import {
  useNetworkClient,
  IChannel,
  NetworkStatus
} from "contexts/network-client-context";

const LeftSideBar: FC<{
  cssClasses?: string;
}> = ({ cssClasses }) => {
  const { openModal, closeModal, setModalView } = useUI();

  const {
    currentChannel,
    channels,
    setCurrentChannel,
    networkStatus
  } = useNetworkClient();

  const onChannelChange = (ch: IChannel) => {
    setCurrentChannel(ch);
  };

  return (
    <div className={cn(s.root, cssClasses)}>
      <div className={s.header}>
        <SpeakEasy />
        {/* <NetworkStatusIcon status={networkStatus} /> */}
      </div>
      <div className={s.content}>
        <Collapse title="JOINED" defaultActive>
          <div className="flex flex-col">
            {channels.map(ch => {
              return (
                <span
                  key={ch.id}
                  className={cn(s.channelPill, "headline--xs", {
                    [s.channelPill__active]:
                      ch.id === (currentChannel?.id || "")
                  })}
                  onClick={() => {
                    onChannelChange(ch);
                  }}
                >
                  {ch.name}
                </span>
              );
            })}
          </div>
        </Collapse>
      </div>
      <div className={s.footer}>
        <Button
          cssClasses={"w-full mb-3"}
          onClick={() => {
            setModalView("JOIN_CHANNEL");
            openModal();
          }}
          disabled={networkStatus !== NetworkStatus.CONNECTED}
        >
          Join
        </Button>
        <Button
          cssClasses={"w-full"}
          onClick={() => {
            setModalView("CREATE_CHANNEL");
            openModal();
          }}
          disabled={networkStatus !== NetworkStatus.CONNECTED}
        >
          Create
        </Button>
        <div className={s.links}>
          <a
            href="https://xx.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            About
          </a>
          |
          <a
            href="https://xx.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            Roadmap
          </a>
          |
          <a
            href="https://xx.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact
          </a>
          |
          <a
            href="https://xx.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            xx network
          </a>
          |
          <a
            href="https://xx.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
};

export default LeftSideBar;
