const db = require("../models");
const Degree = db.degree;


exports.updateDegreesWithDid = async () => {
  try {
      const degrees = await Degree.find().sort({_id: 1});
      let counter = 1; 
      for (let degree of degrees) {
          const result = await Degree.updateOne({ _id: degree._id }, { $set: { Did: counter } });
          counter++;
      }
      return { message: "Successfully updated all degrees with Did",  modified: result.modifiedCount };
  } catch (error) {
      console.log('Error adding Did:', error);
      return { message: "An error occurred while adding Did", error: error.message };
  }
};


exports.getList = async (req, res) => {
  try {
    const data = await Degree.find({});
    return res.status(200).json({ message: "Successfully Get!", data: data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An Error Occured!" });
  }
}

exports.addItem = async (req, res) => {
  try {
      let item = req.body.item;
      const isExist = await Degree.findOne({ degreeName: item });
      const data = await Degree.find({});

      if (isExist) {
          return res.status(200).json({ message: "Degree already exists", data: data });
      } else {
          const highestDegree = await Degree.findOne().sort({ Did: -1 }); 
          const newDid = highestDegree ? highestDegree.Did + 1 : 1;
          const newDegree = new Degree({ degreeName: item, Did: newDid });
          await newDegree.save();
          const newData = await Degree.find({});
          return res.status(200).json({ message: "Degree successfully registered", data: newData });
      }
  } catch (e) {
      console.log(e);
      return res.status(500).json({ message: "An error occurred while adding degree" });
  }
};

exports.deleteItem = async (req, res) => {
  try {
      const { degreeName } = req.body;
      
      const degreeToDelete = await Degree.findOne({ degreeName: degreeName });
      
      if (!degreeToDelete) {
          return res.status(404).json({ message: "Degree not found" });
      }

      await Degree.deleteOne({ degreeName: degreeName });

      return res.status(200).json({ message: "Degree successfully deleted" });
  } catch (e) {
      console.log(e);
      return res.status(500).json({ message: "An error occurred while deleting the degree" });
  }
};
