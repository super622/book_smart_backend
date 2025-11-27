module.exports = mongoose => {
  var schema = mongoose.Schema({
    type: {
      type: String,
      enum: ['clinician', 'facility'],
      required: true
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0'
    },
    content: {
      type: String,
      required: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft'
    },
    publishedDate: {
      type: Date,
      default: null
    },
    createdBy: {
      type: Number, // Admin AId
      default: null
    },
    lastModifiedBy: {
      type: Number, // Admin AId
      default: null
    },
    lastModifiedDate: {
      type: Date,
      default: Date.now
    }
  }, { timestamps: true });

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  const Terms = mongoose.model("Terms", schema);
  return Terms;
};

