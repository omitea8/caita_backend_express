// トークンをtwitterにリクエストする
export const getTokenFromTwitter = async (
  client_id: string,
  client_secret: string,
  code: string,
  challenge: string,
  callback_url: string
) => {
  const url = new URL("https://api.twitter.com/2/oauth2/token");
  const req = new Request(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${client_id}:${client_secret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client_id,
      code: code,
      code_verifier: challenge,
      redirect_uri: callback_url,
    }).toString(),
  });
  const res = await fetch(req);
  return ((await res.json()) as { access_token: string }).access_token;
};
// twitterからユーザー情報を取得する
export const fetchMeFromTwitter = async (access_token: string) => {
  const url = new URL("https://api.twitter.com/2/users/me");
  url.searchParams.append("user.fields", "description,profile_image_url");
  const headers = {
    Authorization: `Bearer ${access_token}`,
  };
  const res = await fetch(url.toString(), { headers });
  // デバッグ用
  console.log(res.headers);
  return (await res.json()) as {
    data: {
      name: string;
      username: string;
      description: string;
      id: string;
      profile_image_url: string;
    };
  };
};
