# k8s/wp — headless WordPress (ADR-0025)

부트스트랩 순서 (모두 1회, 순서 중요):

1. **MariaDB**: `infra/wp-db/README.md` — db-home 에 프로비저닝 + 격리 검증.
2. **Secrets** (k3s-home, git 밖):
   ```sh
   # ① DB 접속 — provision-mariadb.sh 출력 명령 그대로 (네임스페이스가 먼저 필요)
   kubectl create namespace wordpress
   kubectl -n wordpress create secret generic wp-db-credentials \
     --from-literal=WORDPRESS_DB_HOST='192.168.68.52:3306' \
     --from-literal=WORDPRESS_DB_NAME='wordpress' \
     --from-literal=WORDPRESS_DB_USER='wordpress' \
     --from-literal=WORDPRESS_DB_PASSWORD='<provision 출력값>'
   # ② salts 8종 — 무작위 생성
   kubectl -n wordpress create secret generic wp-salts $(for k in \
     WORDPRESS_AUTH_KEY WORDPRESS_SECURE_AUTH_KEY WORDPRESS_LOGGED_IN_KEY WORDPRESS_NONCE_KEY \
     WORDPRESS_AUTH_SALT WORDPRESS_SECURE_AUTH_SALT WORDPRESS_LOGGED_IN_SALT WORDPRESS_NONCE_SALT; \
     do printf -- "--from-literal=%s=%s " "$k" "$(openssl rand -base64 48 | tr -d '\n=+/')"; done)
   ```
   ```sh
   # ③ 미디어 R2 offload(QuizDeck CMS media 모듈) — 자격증명은 media 버킷 스코프 R2 토큰
   #    (구 quizdeck-auth 의 R2_MEDIA_* 값을 이전 — 스코프 실증 2026-07-14). 없으면
   #    미디어만 로컬(비영속)로 남는다(optional Secret).
   kubectl -n wordpress create secret generic wp-media \
     --from-literal=QD_MEDIA_ENDPOINT='https://<account>.r2.cloudflarestorage.com' \
     --from-literal=QD_MEDIA_BUCKET='<media 버킷>' \
     --from-literal=QD_MEDIA_ACCESS_KEY_ID='<access key id>' \
     --from-literal=QD_MEDIA_SECRET_ACCESS_KEY='<secret access key>' \
     --from-literal=QD_MEDIA_BASE_URL='https://media.myquizdeck.com'
   ```
   **미디어 공개 도메인(1회, Cloudflare 대시보드)**: R2 → media 버킷 → Custom Domains 에
   `media.myquizdeck.com` 연결(프록시 자동). r2.dev 공개 URL 은 쓰지 않는다(프로덕션 부적격
   — 레이트 리밋 + 계정 해시 종속 URL).
   ```sh
   # ④ 회원 주석 관리(ADR-0027) — 앱 admin API 공유 토큰. 앱 쪽 quizdeck-auth 의
   #    ADMIN_API_TOKEN 과 같은 값이어야 한다(한 번에 생성해 양쪽 주입). revalidate 토큰과
   #    분리 — 권한 등급(캐시 무효화 vs 회원 데이터 뮤테이션)이 다르다. 없으면 wp-admin
   #    '회원 주석' 화면만 미설정 안내(optional Secret, 앱 API 는 fail-closed 401).
   TOKEN=$(openssl rand -hex 32)
   kubectl -n wordpress create secret generic wp-admin-api \
     --from-literal=QD_ADMIN_API_TOKEN="$TOKEN"
   kubectl -n quizdeck patch secret quizdeck-auth --type merge \
     -p "{\"stringData\":{\"ADMIN_API_TOKEN\":\"$TOKEN\"}}"
   ```
3. **DNS(grey-cloud)**: Cloudflare 에 `wp.myquizdeck.com` A 레코드 → `100.81.230.113`
   (k3s-home Tailscale IP), **프록시 OFF(DNS-only·회색 구름)** — argocd 선례(ADR-0020).
   orange 로 뒤집으면 인터넷에 열린다.
4. **Argo App**: `kubectl apply -f k8s/argocd/wp-application.yaml` — 이후 이 디렉토리는
   Argo 가 동기화한다(첫 이미지는 wp-image.yml 이 push + newTag bump).
5. **WP 설치 마법사**: tailnet 에서 `https://wp.myquizdeck.com` → 사이트 제목·admin
   계정 생성(비밀번호 관리자 보관). 코어/플러그인 설치·수정은 화면에서 금지돼 있다
   (`DISALLOW_FILE_MODS` — 전부 이미지·CI 로).

검증: tailnet 에서 `/wp-login.php` 200 + 유효 인증서, tailnet 밖에서 도달 불가,
`myquizdeck.com` 앱 회귀 없음(argocd verify 프로브 단언 형식).
