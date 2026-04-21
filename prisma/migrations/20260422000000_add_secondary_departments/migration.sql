-- CreateTable
CREATE TABLE "_UserSecondaryDepartments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserSecondaryDepartments_AB_unique" ON "_UserSecondaryDepartments"("A", "B");

-- CreateIndex
CREATE INDEX "_UserSecondaryDepartments_B_index" ON "_UserSecondaryDepartments"("B");

-- AddForeignKey
ALTER TABLE "_UserSecondaryDepartments" ADD CONSTRAINT "_UserSecondaryDepartments_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSecondaryDepartments" ADD CONSTRAINT "_UserSecondaryDepartments_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
