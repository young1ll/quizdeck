# autoinstall seed — db-home

`user-data` + `meta-data`로 Ubuntu Server 24.04 LTS를 **무인 설치**한다. k3s-home에서
검증된 패턴(노VNC/시리얼 콘솔이 막혀 GRUB `autoinstall` + vfat CIDATA 시드 디스크 주입)을
그대로 재사용한다. 이 시드는 **OS + 베이스 패키지(postgres·ufw) + SSH**까지만 만든다.
postgres 구성은 부팅 후 [`../scripts/provision-postgres.sh`](../scripts/provision-postgres.sh)가 한다.

## 1. 플레이스홀더 치환 (커밋 금지)

`user-data`의 두 값을 실제 값으로 바꾼 **로컬 사본**을 만든다. 치환본은 절대 커밋하지 않는다
(`infra/db-vm/.gitignore`가 `*.local`을 무시한다).

```sh
cd infra/db-vm/autoinstall

# SSH 공개키 (키 전용 로그인)
KEY="$(cat ~/.ssh/id_ed25519.pub)"
# 콘솔 폴백 비밀번호 해시 (Synology/Linux: whois 패키지의 mkpasswd)
HASH="$(mkpasswd --method=SHA-512)"   # 프롬프트에 비밀번호 입력

sed -e "s|__SSH_AUTHORIZED_KEY__|$KEY|" \
    -e "s|__PASSWORD_HASH__|$HASH|" \
    user-data > user-data.local
```

> `mkpasswd`가 없으면: `openssl passwd -6` 또는 `python3 -c 'import crypt,getpass; print(crypt.crypt(getpass.getpass(), crypt.mksalt(crypt.METHOD_SHA512)))'`.

## 2. CIDATA 시드 디스크 만들기

cloud-init의 NoCloud 데이터소스는 라벨이 **`CIDATA`** 인 vfat 볼륨에서 `user-data`/`meta-data`를 읽는다.

```sh
# 권장: cloud-utils의 cloud-localds (있으면 한 줄)
cloud-localds -V vfat seed.img user-data.local meta-data

# 없으면 수동 (vfat, 라벨 CIDATA)
truncate -s 8M seed.img
mkfs.vfat -n CIDATA seed.img
mcopy -i seed.img user-data.local ::user-data    # mtools
mcopy -i seed.img meta-data        ::meta-data
```

> NoCloud는 파일명이 **`user-data`/`meta-data`** (확장자 없음)여야 한다. `user-data.local`을
> 볼륨에 넣을 때 이름을 `user-data`로 바꿔 넣는 점에 주의.

`seed.img`도 시크릿(SSH키·해시 포함)이므로 커밋하지 않는다.

## 3. DSM VMM에서 VM 생성

k3s-home과 동일 절차. **OVS "Default VM Network"** 에 붙여 게스트↔게스트(k3s VM)
도달성을 확보한다.

1. VMM → 가상 머신 생성 → Linux. 스펙: **1~2 vCPU · 1GB RAM · 20GB 디스크**, 네트워크
   **Default VM Network**(k3s-home과 동일 OVS).
2. 디스크 2개: **vda**(OS, 20GB) + **vdb**(`seed.img` 업로드 → 추가 디스크로 연결).
3. Ubuntu 24.04 Server ISO를 부팅 미디어로 연결.
4. 부팅 → GRUB에서 `e`로 커널 라인 끝에 **`autoinstall`** 추가(자동 검출이 안 될 때).
   시드가 CIDATA로 인식되면 프롬프트 없이 설치가 진행된다.
5. 설치 끝나면 `shutdown: poweroff`로 자동 종료된다 → **vdb(seed) 디스크를 분리**하고
   ISO도 분리한 뒤 다시 부팅(재부팅 시 autoinstall 재실행 방지).

## 4. 부팅 후

- LAN IP 확인(라우터 DHCP 리스 또는 VM 콘솔 `ip -4 a`). 라우터에서 **정적 예약** 권장.
- 라우터 DHCP 예약으로 IP 고정 후, 그 IP를 [`../README.md`](../README.md) 런북의
  `DB_VM_LAN_IP`로 사용한다.
- 이후 [`../README.md`](../README.md)의 provision → firewall → verify 순서를 따른다.
