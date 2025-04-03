import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import Input, { Props } from 'src/components/common/Input';

const SearchInput: FC<Props> = ({ className, ...props }) => {
  const { t } = useTranslation();
  return (
    <div className={`relative mb-2 ${className || ''}`}>
      <Input {...props} placeholder={props.placeholder || t('Search...')} />
      <div className='absolute inset-y-0 right-2 flex items-center pl-3 pointer-events-none'>
        <svg
          aria-hidden='true'
          className='w-5 h-5 text-charcoal-2'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
          xmlns='http://www.w3.org/2000/svg'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
          ></path>
        </svg>
      </div>
    </div>
  );
};

export default SearchInput;
