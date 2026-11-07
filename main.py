from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mistralai import ChatMistralAI
from langchain_community.document_loaders import PyPDFLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

load_dotenv()

embedding_model=HuggingFaceEmbeddings( model_name="BAAI/bge-small-en-v1.5")

vectorStore = Chroma(
    persist_directory="chroma-db",
    embedding_function=embedding_model
)

retriever=vectorStore.as_retriever(
    search_type="mmr",
    search__kwarg= {
        "k":4,
        "fetch_k":10,
        "lambda_mult":0.5
    }
)

llm=ChatGroq(model="openai/gpt-oss-120b",temperature=0)

# prompt Tamplet

prompt=ChatPromptTemplate.from_messages(
    [
        ("system",
            """
            You are a helpful AI assistant.
            Use ONLY the provided context to answer the question.
            If the answer is not present in the context,
            say: "I could not find the answer in the document."

            """
        ),
        (
            "human",
            """
            Context:
            {context}

            Question:
            {question}
            """
        )
    ]
)

print("-------------------------RAG system Created----------------------------")
print("pess 0 to exit ")

while True:
    query=input("You: ")
    if(query==0):
        break
    docs=retriever.invoke(query)

    context='/n/n'.join([doc.page_content for doc in docs])
    final_prompt=prompt.invoke({
        "context" : context,
        "question" : query
    })

    response=llm.invoke(final_prompt)

    print(f"/n AI: {response.content}")

    print("--------------------------------------------------------------------------")



