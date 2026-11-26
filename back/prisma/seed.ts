import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ROLES, ROLE_CODES } from "../constants/user.constants.js";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../constants/permissions.constants.js";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_UNITS,
  DEFAULT_VAT_RATES,
} from "../constants/catalog.constants.js";
import {
  DEFAULT_MIN_MARKUP_PCT,
  PARTNER_SEQUENCE,
  QUOTE_SEQUENCE,
  SETTING_MIN_MARKUP_PCT,
} from "../constants/quote.constants.js";

/**
 * The five job titles the app ships with. The migration also imported whatever
 * the data already used, so this only guarantees a fresh database is usable —
 * it never removes a position someone added in the UI.
 */
const DEFAULT_POSITIONS = [
  "Technician",
  "Team leader",
  "Project manager",
  "Sales",
  "Administration",
];

async function main() {
  console.log("Seeding positions...");
  for (const name of DEFAULT_POSITIONS) {
    await prisma.position.upsert({
      where: { name },
      // Left alone on update: retiring one in the UI must survive a reseed.
      update: {},
      create: { name },
    });
  }

  // Items cannot be created without a unit and a VAT code, so a fresh database
  // needs these. Left alone on update, like positions: anything changed later
  // (by an admin, or by the ProData sync) must survive a reseed.
  console.log("Seeding units...");
  for (const unit of DEFAULT_UNITS) {
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    });
  }

  console.log("Seeding VAT rates...");
  for (const vat of DEFAULT_VAT_RATES) {
    // A DATE column: midnight UTC stores exactly the calendar day.
    const validFrom = new Date(`${vat.validFrom}T00:00:00Z`);
    await prisma.vatRate.upsert({
      where: { code_validFrom: { code: vat.code, validFrom } },
      update: {},
      create: { code: vat.code, name: vat.name, rate: vat.rate, validFrom },
    });
  }

  // Left alone on update: a rename in the UI must survive a reseed. A renamed
  // default does come back under its old name, as an empty extra category.
  console.log("Seeding categories...");
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Left alone on update: next_number is live data, and an admin may have
  // changed the threshold. (The quote sequence of a later year is created by
  // the first quote of that year; this row only makes a fresh database tidy.)
  console.log("Seeding document sequences and settings...");
  const year = new Date().getFullYear();
  for (const sequence of [
    { docType: QUOTE_SEQUENCE.docType, year, prefix: QUOTE_SEQUENCE.prefix },
    {
      docType: PARTNER_SEQUENCE.docType,
      year: PARTNER_SEQUENCE.year,
      prefix: PARTNER_SEQUENCE.prefix,
    },
  ]) {
    await prisma.documentSequence.upsert({
      where: { docType_year: { docType: sequence.docType, year: sequence.year } },
      update: {},
      create: sequence,
    });
  }
  await prisma.appSetting.upsert({
    where: { key: SETTING_MIN_MARKUP_PCT },
    update: {},
    create: { key: SETTING_MIN_MARKUP_PCT, value: DEFAULT_MIN_MARKUP_PCT },
  });

  console.log("Seeding roles...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, isSystem: true },
      create: { code: role.code, name: role.name, isSystem: true },
    });
  }

  await pruneRenamedRoles();

  console.log("Seeding permissions...");
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }

  console.log("Seeding role permissions...");
  const roleRows = await prisma.role.findMany({ select: { id: true, code: true } });
  const permissionRows = await prisma.permission.findMany({ select: { id: true, code: true } });
  const roleId = new Map(roleRows.map((r) => [r.code, r.id]));
  const permissionId = new Map(permissionRows.map((p) => [p.code, p.id]));

  for (const [code, grants] of Object.entries(ROLE_PERMISSIONS)) {
    const rid = roleId.get(code);
    if (rid === undefined) continue;

    // Rebuild this role's matrix row so removed grants actually disappear.
    await prisma.rolePermission.deleteMany({ where: { roleId: rid } });

    for (const [permissionCode, scope] of grants) {
      const pid = permissionId.get(permissionCode);
      if (pid === undefined) {
        console.warn(`  ! unknown permission "${permissionCode}" for role "${code}"`);
        continue;
      }
      await prisma.rolePermission.create({
        data: { roleId: rid, permissionId: pid, scope },
      });
    }
  }

  await seedBootstrapAdmin();

  console.log("Seed complete.");
}

/**
 * Drop roles that are no longer in the catalogue.
 *
 * The seed upserts by `code`, so renaming `pm` -> `project_manager` and
 * `tl` -> `team_leader` created new rows and left the originals behind with
 * no permissions attached. They are invisible in the app but render as empty
 * duplicate columns in the Groups & permissions matrix.
 *
 * Only ever deletes a role nobody holds. If someone still has one, it is
 * reported and kept, because deleting it would silently strip their access.
 */
async function pruneRenamedRoles() {
  const known = Object.values(ROLE_CODES) as string[];

  const stale = await prisma.role.findMany({
    where: { code: { notIn: known } },
    select: { id: true, code: true, _count: { select: { users: true } } },
  });

  for (const role of stale) {
    if (role._count.users > 0) {
      console.warn(
        `  ! role "${role.code}" is not in the catalogue but ${role._count.users} user(s) still hold it — leaving it alone.`
      );
      continue;
    }
    await prisma.role.delete({ where: { id: role.id } });
    console.log(`  - removed stale role "${role.code}"`);
  }
}

async function seedBootstrapAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !email || !password) {
    console.log(
      "Skipping bootstrap admin (set SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)."
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Bootstrap admin "${username}" already exists — leaving it untouched.`);
    return;
  }

  const superAdmin = await prisma.role.findUniqueOrThrow({
    where: { code: ROLE_CODES.SUPER_ADMIN },
  });

  const employee = await prisma.employee.create({
    data: {
      firstName: "System",
      lastName: "Administrator",
      // connectOrCreate: this title is deliberately not one of the five defaults.
      position: {
        connectOrCreate: {
          where: { name: "Managing director" },
          create: { name: "Managing director" },
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      username,
      email,
      password: await bcrypt.hash(password, 10),
      status: "ACTIVE",
      employeeId: employee.id,
      roles: { create: { roleId: superAdmin.id } },
    },
  });

  console.log(`Created bootstrap super admin "${username}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
