# iPhone widget (Scriptable)

Shows your open assigned Family tasks on the iOS Home Screen using the free
[Scriptable](https://scriptable.app) app and a read-only widget token.

## 1. Create a token

Log in, then (from the browser console or curl) call:

```bash
JWT=$(curl -s -X POST https://YOUR_HOST/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"me","password":"..."}' | jq -r .token)
curl -s -X POST https://YOUR_HOST/api/widget/token -H "Authorization: Bearer $JWT"
```

Save the returned `fw_...` token; it is shown once. Calling it again rotates
it; `DELETE /api/widget/token` revokes it. The token can only read your
assigned tasks via `GET /api/widget/tasks`.

The phone must reach your server (LAN, VPN such as Tailscale, or HTTPS reverse
proxy). Prefer HTTPS since the token travels in a header.

## 2. Add the script

In Scriptable, create a script with the contents of
[`scripts/ios/TaskWidget.js`](../scripts/ios/TaskWidget.js), set `BASE_URL` and
`TOKEN`, then add a Scriptable widget to the Home Screen and choose the script.

The script excludes chores and private tasks. Tapping the widget opens
`https://tasks.stephanfamily.com`; change `w.url` if your web app uses another
address. This can differ from `BASE_URL` when fetching tasks over LAN or VPN.

## Later: native WidgetKit app (option 3)

A SwiftUI app with a WidgetKit extension can call the same
`/api/widget/tasks` endpoint, storing the token in the Keychain (shared via an
App Group). Needs an Apple developer account for non-expiring installs.
