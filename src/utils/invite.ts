const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}
