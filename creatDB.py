#load pdf
# split into chunnks
# create the embedding
# strore in chroma

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mistralai import ChatMistralAI
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

load_dotenv()

loader=PyPDFLoader("MachineLearningNotes.pdf")
docs=loader.load()

splitter=RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200

)

chunks=splitter.split_documents(docs)

embedding_model=HuggingFaceEmbeddings( model_name="BAAI/bge-small-en-v1.5")

vectorStore=Chroma.from_documents(
    documents=chunks,
    embedding=embedding_model,
    persist_directory="chroma-db"

)