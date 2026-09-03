/**
 * www 를 apex 로 301 보낸다.
 *
 * www.aubcompany.com 은 원래 DNS 응답 자체가 없어 www 를 붙여 치면 사이트를 못 봤다.
 * Pages 커스텀 도메인으로 붙이면서 접속은 되게 했는데, 그러면 apex 와 www 가 둘 다
 * 200 을 반환해 검색엔진이 같은 사이트를 둘로 볼 수 있다. canonical 이 apex 를
 * 가리키고 있어 구글은 합쳐 보지만, 네이버까지 믿고 맡기기엔 약하다.
 *
 * Cloudflare 쪽 리다이렉트 룰로 처리하려면 zone 쓰기 권한이 필요해서,
 * 저장소 안에서 끝나는 이 방법을 쓴다.
 */

const APEX = 'aubcompany.com';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === `www.${APEX}`) {
    url.hostname = APEX;
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
