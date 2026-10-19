import { useState, type ImgHTMLAttributes } from 'react';

/**
 * A product photo that never shows a broken-image icon. Photos still linked
 * to a brand's site may refuse to load from ours: it retries without telling
 * that site where it is shown, and if that fails too it disappears (onFail).
 */
export function SafeImg({ onFail, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { onFail?: () => void }) {
  const [step, setStep] = useState(0);
  if (step >= 2) return null;
  return (
    <img
      {...rest}
      key={step}
      referrerPolicy={step === 1 ? 'no-referrer' : rest.referrerPolicy}
      onError={() => {
        if (step === 0) setStep(1);
        else {
          setStep(2);
          onFail?.();
        }
      }}
    />
  );
}
