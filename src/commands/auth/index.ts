import { Command } from "commander";
import { buildRegisterCommand } from "./register";
import { buildLoginCommand } from "./login";
import { buildLogoutCommand } from "./logout";
import { buildStatusCommand } from "./status";

export function buildAuthCommand(): Command {
  const command = new Command("auth")
    .description("Manage Arden authentication")
    .addCommand(buildRegisterCommand())
    .addCommand(buildLoginCommand())
    .addCommand(buildLogoutCommand())
    .addCommand(buildStatusCommand());

  return command;
}
