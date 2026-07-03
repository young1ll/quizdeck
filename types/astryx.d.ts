// astryx Button 커스텀 variant 등록 (A1 Path-B / A2). astryx 의 ButtonVariantMap 를 module
// augmentation 으로 확장하면 dangerOutline 이 유효한 ButtonVariant 가 된다(타입). 런타임 룩은
// lib/astryx-theme.ts 의 components.button['variant:dangerOutline'] 이 공급한다 — astryx 는
// 하드코드 variants[] 에 없는 variant 도 themeProps 로 `.dangerOutline`/data-variant 를 방출하고,
// 테마 override CSS(`.astryx-button.dangerOutline`)가 그 요소에 얹힌다.
import "@astryxdesign/core/Button";

declare module "@astryxdesign/core/Button" {
  interface ButtonVariantMap {
    dangerOutline: true;
  }
}
