// models/djob.model.js (factory style, same as yours)
module.exports = (mongoose) => {
    const ShiftSchema = new mongoose.Schema(
      {
        date: { type: String, required: true, trim: true }, // "October 18, 2025"
        time: { type: String, required: true, trim: true }, // "8:38 PM ➔ 11:38 PM"
      },
      { _id: false }
    );
  
    const schema = new mongoose.Schema({
      DJobId: { type: Number, required: true, unique: true, index: true },
  
      shift: { type: ShiftSchema, required: true },
  
      degree:      { type: Number, required: true },
      adminId:     { type: Number, required: true },
      adminMade:   { type: Boolean, default: false },
      facilitiesId:{ type: Number, default: 0 },
      clinicianId: { type: Number, default: 0 },
    }, { timestamps: true });
  
    schema.method("toJSON", function () {
      const { _id, __v, ...object } = this.toObject();
      object.id = _id;
      return object;
    });
  
    schema.index({ DJobId: 1 });
  
    return mongoose.model("DJob", schema);
  };
  