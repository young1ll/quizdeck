# wp-db — db-home 의 MariaDB (headless WordPress tier, ADR-0025)

WordPress 는 MySQL 계열 전용이라(코어 wpdb — postgres 미지원) 기존 db-home VM 에
**MariaDB 를 postgres 옆에** 추가한다. 격리 불변식은 postgres 와 동일: **3306 은 k3s VM
(192.168.68.55)에서만**, 인터넷·호스트·기타 tailnet 차단.

## 실행 (db-home 콘솔 또는 SSH 에서, 1회)

> dev 머신 키는 db-home 에 등록돼 있지 않다 — DSM VMM 콘솔로 들어가거나,
> `dbadmin` 의 `~/.ssh/authorized_keys` 에 키를 추가한 뒤 `ssh -J young1ll@k3s-home
> dbadmin@192.168.68.52` 로 점프한다.

```sh
sudo K3S_VM_IP=192.168.68.55 ./provision-mariadb.sh        # 설치·바인딩·DB/유저 (멱등)
sudo K3S_VM_IP=192.168.68.55 ./configure-firewall-mariadb.sh  # ufw 3306 allow-list (멱등)
```

`provision-mariadb.sh` 가 마지막에 **wp-db-credentials Secret 생성 명령을 출력**한다 —
비밀번호는 그 자리에서만 보이니 바로 k3s-home 에서 실행한다(git 커밋 금지).

## 검증

```sh
# k3s-home 에서 (열려야 함):
nc -zv 192.168.68.52 3306
# dev 머신 등 그 외에서 (막혀야 함):
nc -zv 192.168.68.52 3306   # timeout 기대
```

## 백업

R2 야간 백업(ADR-0021, k8s/backup)은 현재 postgres 만 덤프한다 — **WP 콘텐츠가 유일
소스가 되는 3단계 전에 mariadb-dump 를 cronjob 에 추가**해야 한다(전환 계획의 게이트).
