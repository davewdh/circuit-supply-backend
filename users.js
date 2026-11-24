import bcrypt from 'bcryptjs';

export function usesLegacyAdminPassword(user) {
    return user.email === "davewdh@gmail.com" && bcrypt.compareSync('1234', user.password);
}
