import React from 'react';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';

export interface PasswordCriteriaResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  passedCount: number;
  missingRequirements: string[];
}

export function validatePasswordCriteria(password: string): PasswordCriteriaResult {
  const pwd = password || '';
  const hasMinLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  // Matches all common special characters: !@#$%^&*()_+ -= []{}:;"'<>,.?/~` or any non-alphanumeric character
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]|[^A-Za-z0-9\s]/.test(pwd);

  const missingRequirements: string[] = [];
  if (!hasMinLength) missingRequirements.push('कम से कम 8 अक्षर (Min 8 characters)');
  if (!hasUpper) missingRequirements.push('कम से कम एक बड़ा अक्षर (A-Z)');
  if (!hasLower) missingRequirements.push('कम से कम एक छोटा अक्षर (a-z)');
  if (!hasNumber) missingRequirements.push('कम से कम एक नंबर (0-9)');
  if (!hasSpecial) missingRequirements.push('कम से कम एक विशेष चिन्ह (!@#$%^&*...)');

  let passedCount = 0;
  if (hasMinLength) passedCount++;
  if (hasUpper) passedCount++;
  if (hasLower) passedCount++;
  if (hasNumber) passedCount++;
  if (hasSpecial) passedCount++;

  return {
    isValid: hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial,
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    passedCount,
    missingRequirements,
  };
}

interface PasswordCriteriaChecklistProps {
  password: string;
  className?: string;
  showAlways?: boolean;
}

export const PasswordCriteriaChecklist: React.FC<PasswordCriteriaChecklistProps> = ({
  password,
  className = '',
  showAlways = true,
}) => {
  if (!showAlways && !password) return null;

  const result = validatePasswordCriteria(password);
  const isStarted = Boolean(password && password.length > 0);

  const criteria = [
    { label: 'कम से कम 8 अक्षर (Min 8 chars)', met: result.hasMinLength },
    { label: '1 बड़ा अक्षर (A-Z)', met: result.hasUpper },
    { label: '1 छोटा अक्षर (a-z)', met: result.hasLower },
    { label: '1 नंबर (0-9)', met: result.hasNumber },
    { label: '1 विशेष चिन्ह (!@#$%...)', met: result.hasSpecial },
  ];

  return (
    <div className={`mt-2 p-2.5 rounded-xl bg-[#FAF7F0] border border-[#C99B42]/30 text-xs ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold text-[#102C47] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C99B42]" />
          पासवर्ड सुरक्षा नियम (Password Rules):
        </span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            result.isValid
              ? 'bg-emerald-100 text-emerald-800'
              : isStarted
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {result.passedCount}/5 पूर्ण
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${
            result.passedCount === 5
              ? 'bg-emerald-500 w-full'
              : result.passedCount >= 3
                ? 'bg-amber-500'
                : 'bg-red-400'
          }`}
          style={{ width: `${(result.passedCount / 5) * 100}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
        {criteria.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-1.5 py-0.5 transition-colors ${
              item.met
                ? 'text-emerald-700 font-semibold'
                : isStarted
                  ? 'text-gray-500'
                  : 'text-gray-400'
            }`}
          >
            {item.met ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            )}
            <span className="leading-tight">{item.label}</span>
          </div>
        ))}
      </div>

      {result.isValid && (
        <p className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10.5px] font-semibold text-emerald-700 flex items-center gap-1">
          ✓ मजबूत और सुरक्षित पासवर्ड तैयार है! (Strong Password Ready)
        </p>
      )}
    </div>
  );
};

