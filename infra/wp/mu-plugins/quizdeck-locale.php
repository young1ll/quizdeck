<?php
/**
 * Plugin Name: QuizDeck Locale (ko_KR)
 * Description: 사이트 기본 언어를 ko_KR 로 고정 — DB 옵션(WPLANG) 수동 설정 대신 코드가 소유
 *              (GitOps — 무상태 pod 원칙과 일치). 언어팩은 이미지에 구워져 있다(infra/wp/Dockerfile).
 *              pre_option 은 사이트 기본값만 바꾸므로 사용자 프로필의 개별 언어 선택은 그대로 동작한다.
 */
add_filter( 'pre_option_WPLANG', static fn() => 'ko_KR' );
