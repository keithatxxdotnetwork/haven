import type { FC, HTMLAttributes } from 'react';

import dayjs from 'dayjs';
import cn from 'classnames';
import { useTranslation } from 'react-i18next';

import s from './Space.module.scss';
import React from 'react';
import { Star } from 'lucide-react';

type Props = HTMLAttributes<HTMLDivElement> & {
  favorite?: boolean;
  active?: boolean;
  name: string | React.ReactNode;
  message: string;
  date?: string;
  missedMessagesCount: number;
};

const Space: FC<Props> = ({
  active,
  date,
  favorite,
  message,
  missedMessagesCount = 0,
  name,
  ...props
}) => {
  const { t } = useTranslation();

  return (
    <div {...props} className={cn(props.className, s.root, { [s.active]: active })}>
      <div className='flex justify-between w-full items-center space-x-2'>
        <h5 className={cn(s.name, 'flex items-center space-x-1')}>
          {name}
          {favorite && (
            <Star width='12' height='20' className='text-primary ml-1' fill='currentColor' />
          )}
        </h5>
        <div className='flex space-x-1'>
          {date ? (
            <span className={s.date}>{dayjs(date).format('YYYY/MM/DD')}</span>
          ) : (
            <span className='text-primary text-xs'>{t('New!')}</span>
          )}
        </div>
      </div>
      {message && (
        <div className='flex justify-between w-full'>
          <p className={cn('whitespace-nowrap', s['message-preview'])}>{message}</p>
          {missedMessagesCount > 0 && (
            <span className={cn(s.badge, 'ml-1')}>{missedMessagesCount}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default Space;
