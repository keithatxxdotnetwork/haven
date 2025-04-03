import { FC, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'src/components/common';
import { useNetworkClient } from 'src/contexts/network-client-context';
import { useUI } from 'src/contexts/ui-context';

const ExportCodenameView: FC = () => {
  const { t } = useTranslation();
  const { closeModal } = useUI();
  const { exportPrivateIdentity } = useNetworkClient();
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    setError('');
    if (password.length) {
      const result = await exportPrivateIdentity(password);
      if (result) {
        closeModal();
      } else {
        setError(t('Incorrect password'));
      }
    }
  }, [t, closeModal, exportPrivateIdentity, password]);

  return (
    <div className='w-full flex flex-col justify-center items-center'>
      <h2 className='mt-9 mb-4'>{t('Export codename')}</h2>
      <p className='mb-8 font-medium text-xs leading-tight text-cyan max-w-[520px] text-left w-full'>
        {t(`You can export your codename for backup or to use your codename on a
        second device.`)}
      </p>
      <input
        type='password'
        placeholder={t('Unlock export with your password')}
        value={password}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter') {
            handleSubmit();
          }
        }}
        onChange={(e) => {
          setPassword(e.target.value);
        }}
        className='border-none outline-none bg-dark-5 px-2.5 py-4.5 text-text-primary text-sm w-full max-w-[520px] h-[55px] rounded mb-6.5'
      />

      {error && <div className='text-xs mt-2 text-red'>{error}</div>}
      <Button className='mt-5 text-black mb-30' onClick={handleSubmit}>
        {t('Export')}
      </Button>
    </div>
  );
};

export default ExportCodenameView;
