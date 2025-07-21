import { Command } from "commander";
import { registerCommand } from "./register";
import { loginCommand } from "./login";
import { logoutCommand } from "./logout";
import { statusCommand } from "./status";

export const authCommand = new Command("auth")
  .description("Manage Arden authentication")
  .addCommand(registerCommand)
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(statusCommand);
