import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT ?? 2525);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function enviarCredenciales(
  correo: string,
  username: string,
  passwordInicial: string
): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: correo,
    subject: "Bienvenido al Sistema de Reservas de Cine",
    text: [
      "Tu cuenta ha sido creada correctamente.",
      "",
      `Usuario: ${username}`,
      `Contraseña inicial: ${passwordInicial}`,
      "",
      "Por seguridad, cambia tu contraseña después de iniciar sesión."
    ].join("\n")
  });
}