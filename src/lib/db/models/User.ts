import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ACCENT_COLORS, THEME_MODES } from '@/types';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, default: '' },
    defaultSenderPhone: { type: String, default: '' },
    defaultSenderEmail: { type: String, default: '' },
    themeMode: { type: String, enum: THEME_MODES, default: 'system' },
    accentColor: { type: String, enum: ACCENT_COLORS, default: 'blue' },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Schema.Types.ObjectId };
export const User: Model<InferSchemaType<typeof UserSchema>> =
  (models.User as Model<InferSchemaType<typeof UserSchema>>) ?? model('User', UserSchema);
