const simpleGit = require("simple-git");

function createPublication({ root, sync, gitFactory = simpleGit }) {
  const contentPaths = [
    "db.json",
    "docs/db.js",
    "docs/assets",
    ":(exclude)**/.DS_Store",
  ];
  let publishing = false;
  const git = () =>
    gitFactory({
      baseDir: root,
      timeout: { block: 30000 },
      maxConcurrentProcesses: 1,
    }).env({
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
    });
  async function status() {
    const repository = git();
    const branch = (await repository.raw(["branch", "--show-current"])).trim();
    const remote = (await repository.raw(["remote", "get-url", "origin"]))
      .trim()
      .replace(/(https?:\/\/)[^/@]+@/g, "$1[masqué]@");
    const changes = await repository.raw([
      "status",
      "--porcelain",
      "--",
      ...contentPaths,
    ]);
    const name = (
      await repository.raw(["config", "--get", "user.name"]).catch(() => "")
    ).trim();
    const email = (
      await repository.raw(["config", "--get", "user.email"]).catch(() => "")
    ).trim();
    return {
      branch,
      remote,
      changes: changes.split("\n").filter(Boolean).length,
      identityConfigured: Boolean(name && email),
      publishing,
    };
  }
  async function verify() {
    await git().raw(["push", "--dry-run", "origin", "HEAD:main"]);
    return { ok: true, message: "Ce PC est autorisé à publier sur GitHub." };
  }
  async function publish() {
    if (publishing)
      throw Object.assign(new Error("Une publication est déjà en cours."), {
        status: 409,
      });
    publishing = true;
    try {
      const repository = git();
      const current = await status();
      if (current.branch !== "main")
        throw Object.assign(
          new Error("La publication doit se faire depuis la branche main."),
          { status: 409 },
        );
      if (!current.identityConfigured)
        throw Object.assign(
          new Error(
            "L’identité Git de ce PC doit être configurée avant de publier.",
          ),
          { status: 409 },
        );
      const staged = (
        await repository.raw(["diff", "--cached", "--name-only", "-z"])
      )
        .split("\0")
        .filter(Boolean);
      if (
        staged.some(
          (file) =>
            !/^(db\.json$|docs\/db\.js$|docs\/assets\/)/.test(file) ||
            file.endsWith(".DS_Store"),
        )
      )
        throw Object.assign(
          new Error(
            "Des fichiers hors du contenu pédagogique sont déjà préparés dans Git. Publiez-les séparément avant de continuer.",
          ),
          { status: 409 },
        );
      sync();
      await repository.raw(["add", "--", ...contentPaths]);
      const changes = (
        await repository.raw(["diff", "--cached", "--name-only"])
      ).trim();
      let commit;
      if (changes)
        commit = await repository.commit(
          `Contenu Code Alkhayrat · ${new Date().toISOString()}`,
        );
      await repository.raw(["push", "origin", "HEAD:main"]);
      return {
        ok: true,
        commit: commit?.commit || null,
        message: changes
          ? "Le contenu est enregistré et envoyé sur GitHub."
          : "GitHub est à jour.",
      };
    } catch (error) {
      if (error.status) throw error;
      throw Object.assign(
        new Error(
          "Publication non terminée. Les enregistrements locaux sont conservés. Vérifiez la connexion et l’autorisation GitHub ; si la version distante a changé, mettez le PC à jour avant de réessayer.",
        ),
        { status: 502 },
      );
    } finally {
      publishing = false;
    }
  }
  return { status, verify, publish };
}
module.exports = { createPublication };
