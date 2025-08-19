import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true, trim: true, minlength: 3 })
  name!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  // 👇 IMPORTANT: explicitly set type for union (string | null)
  @Prop({ type: String, default: null, required: false })
  refreshTokenHash?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
