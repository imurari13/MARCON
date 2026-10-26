import mongoose,{Schema,type Document}from"mongoose";
export interface IJob extends Document{title:string;department?:string;description?:string;status:"OPEN"|"CLOSED";createdBy:mongoose.Types.ObjectId}
export interface ICandidate extends Document{jobId:mongoose.Types.ObjectId;name:string;email:string;stage:string;notes?:string;ownerId:mongoose.Types.ObjectId}
const jobSchema=new Schema<IJob>({title:{type:String,required:true,trim:true},department:String,description:String,status:{type:String,enum:["OPEN","CLOSED"],default:"OPEN"},createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true}},{timestamps:true});
const candidateSchema=new Schema<ICandidate>({jobId:{type:Schema.Types.ObjectId,ref:"Job",required:true},name:{type:String,required:true},email:{type:String,required:true,lowercase:true},stage:{type:String,default:"APPLIED"},notes:String,ownerId:{type:Schema.Types.ObjectId,ref:"User",required:true}},{timestamps:true});
export const Job=mongoose.model<IJob>("Job",jobSchema);export const Candidate=mongoose.model<ICandidate>("Candidate",candidateSchema);
