import { TextInput, type TextInputType } from "@astryxdesign/core/TextInput";

// 공통 폼 입력 프리미티브 — astryx TextInput 래퍼 (ADR-0014 Phase 1, ADR-0007 결정 1 계승). 호출부
// 시그니처(label/type/value/onChange/placeholder/autoComplete/required/minLength/disabled)는 **그대로
// 유지**하고 내부만 astryx 로 매핑한다. astryx onChange 는 (value, e) → 우리 onChange(value) 로 좁힌다.
// autoComplete·minLength·required(네이티브 브라우저 검증)는 astryx 타입 표면(BaseProps=HTMLAttributes)
// 밖이지만 TextInput 이 ...rest 를 <input> 에 흘리므로 캐스트해 통과시킨다. 네이티브 required 를 그대로
// 두면 브라우저 검증 + 암묵 aria-required 가 유지된다(astryx isRequired 는 별표 노이즈라 미사용).
export function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  minLength,
  disabled,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
}) {
  return (
    <TextInput
      label={label}
      type={type as TextInputType}
      value={value}
      onChange={(v) => onChange(v)}
      placeholder={placeholder}
      isDisabled={disabled || undefined}
      // 네이티브 input 속성(astryx 타입 표면 밖)은 ...rest → <input> 경유로 통과: 브라우저 검증·비번관리자.
      {...({ autoComplete, minLength, required } as Record<string, unknown>)}
    />
  );
}
