import { model, Schema } from 'mongoose';

const bilingual = new Schema({ bn: String, en: String }, { _id: false });
const point = new Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] },
  { _id: false },
);

const divisionSchema = new Schema(
  { key: { type: String, unique: true }, name: bilingual, order: Number },
  { timestamps: true },
);
const districtSchema = new Schema(
  { key: { type: String, unique: true }, division: String, name: bilingual, order: Number },
  { timestamps: true },
);
const areaSchema = new Schema(
  { key: { type: String, unique: true }, district: String, name: bilingual, order: Number },
  { timestamps: true },
);
const hospitalSchema = new Schema(
  {
    nameBn: String,
    nameEn: String,
    aliases: [String],
    division: String,
    district: String,
    area: String,
    location: point,
    verified: Boolean,
  },
  { timestamps: true },
);

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ nameBn: 'text', nameEn: 'text', aliases: 'text' });

export const GeoDivision = model('GeoDivision', divisionSchema);
export const GeoDistrict = model('GeoDistrict', districtSchema);
export const GeoArea = model('GeoArea', areaSchema);
export const Hospital = model('Hospital', hospitalSchema);
