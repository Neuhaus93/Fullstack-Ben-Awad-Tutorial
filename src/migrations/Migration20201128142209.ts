import { Migration } from '@mikro-orm/migrations';

export class Migration20201128142209 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" drop constraint "user_username_unique";');
  }

}
