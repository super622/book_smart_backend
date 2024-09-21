module.exports = mongoose => {
    var schema = mongoose.Schema({
        locationName: {
            type: String,
            default: ''
        },
    });
  
    schema.method("toJSON", function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });
  
  
    const Location = mongoose.model("Location", schema);
    return Location;
};